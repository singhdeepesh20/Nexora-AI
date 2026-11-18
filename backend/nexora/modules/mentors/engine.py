"""Mentor engine: learning orchestrator + teaching, Socratic, coding and research agents.

Works fully offline with deterministic, curriculum-grounded fallback responses. When a local
Ollama model is available and selected, the same retrieval grounding is passed to the model.
Mentors have NO tools: they cannot run code, read files or touch the system.
"""

from __future__ import annotations

import ast
import re
from typing import Any

from sqlalchemy import literal_column, select
from sqlalchemy.orm import Session

from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import Conversation, ConversationMessage, MentorMemory
from nexora.infrastructure.local_ai.ollama import ModelProvider, ProviderUnavailable
from nexora.modules.curriculum.catalog import Catalog
from nexora.modules.curriculum.sync import search_content
from nexora.modules.mentors.personas import MODES, PERSONAS, system_prompt

CODE_HINT = re.compile(r"(traceback|error|exception|bug|def |import |\bfails?\b|```)", re.I)
RESEARCH_HINT = re.compile(r"\b(paper|research|hypothes|experiment design|ablation|reproduc|literature)\w*", re.I)

EXCEPTION_GUIDE = {
    "NameError": "A name is used before it is defined - check spelling, imports, and that the variable is assigned on every path.",
    "TypeError": "An operation received a value of the wrong type or the wrong number of arguments. Print type(x) of the values on the failing line.",
    "IndexError": "An index is outside the sequence. Check off-by-one errors: valid indices are 0..len-1.",
    "KeyError": "A dict key does not exist. Use `key in d` or d.get(key) and verify the key's exact spelling and type.",
    "ValueError": "The type is right but the value is not - in NumPy this is often a shape mismatch. Print .shape of every array on the line.",
    "ZeroDivisionError": "A denominator is zero - handle empty inputs or constant data explicitly.",
    "AttributeError": "The object does not have that attribute - often a None returned by a function that forgot to `return`.",
    "ImportError": "The module or name cannot be imported - check the exact function names the mission requires.",
    "ModuleNotFoundError": "The module is not installed in the exercise environment; missions only allow the standard library, NumPy and scikit-learn.",
    "IndentationError": "Inconsistent indentation - use 4 spaces, never mix tabs and spaces.",
    "SyntaxError": "Python cannot parse the code - look at the reported line and the line before it for missing colons, brackets or quotes.",
    "RecursionError": "A recursive function never reaches its base case.",
    "MemoryError": "The program allocated too much memory - avoid building huge intermediate lists or matrices.",
    "AssertionError": "A test's expectation was not met - compare the expected and actual values in the message.",
    "NotImplementedError": "A starter stub is still in place - implement that function.",
    "PermissionError": "The exercise sandbox blocked an operation (network, subprocess or writing outside the exercise folder).",
}


class MentorEngine:
    def __init__(self, session: Session, catalog: Catalog, provider: ModelProvider | None):
        self.s, self.catalog, self.provider = session, catalog, provider

    # ---- orchestrator
    def choose_mode(self, message: str, requested: str) -> str:
        if requested in MODES:
            return requested
        if RESEARCH_HINT.search(message):
            return "research"
        if CODE_HINT.search(message):
            return "coding"
        return "explain"

    def respond(self, student_id: str, mentor_id: str, message: str, mode: str = "auto",
                conversation_id: str | None = None, model: str | None = None) -> dict[str, Any]:
        if mentor_id not in PERSONAS:
            raise KeyError(mentor_id)
        mode = self.choose_mode(message, mode)
        conv = self.s.get(Conversation, conversation_id) if conversation_id else None
        if conv is None or conv.student_id != student_id:
            conv = Conversation(student_id=student_id, mentor_id=mentor_id, title=message[:80])
            self.s.add(conv)
            self.s.flush()
        history = list(self.s.scalars(select(ConversationMessage).where(ConversationMessage.conversation_id == conv.id)
                                      .order_by(ConversationMessage.created_at, literal_column("conversation_messages.rowid"))))
        self.s.add(ConversationMessage(conversation_id=conv.id, role="student", content=message))
        refs = self._references(message)
        concept_id = refs[0]["concept_id"] if refs else None
        memory = self._memory(student_id, mentor_id)

        reply, source, note = None, "fallback", None
        if model and self.provider is not None:
            msgs = [{"role": "system", "content": system_prompt(mentor_id, mode, refs)}]
            for m in history[-10:]:
                msgs.append({"role": "user" if m.role == "student" else "assistant", "content": m.content})
            msgs.append({"role": "user", "content": message})
            try:
                reply, source = self.provider.chat(model, msgs), f"ollama:{model}"
            except ProviderUnavailable as exc:
                note = f"The local model could not be reached ({exc}); answering in offline mode."
        if reply is None:
            reply = self._fallback(mentor_id, mode, message, refs, concept_id, memory)
            if note:
                reply = f"_{note}_\n\n" + reply

        self.s.add(ConversationMessage(conversation_id=conv.id, role="mentor", content=reply, source=source))
        self._remember(student_id, mentor_id, memory, concept_id)
        return {"conversation_id": conv.id, "mentor_id": mentor_id, "mode": mode, "source": source, "reply": reply,
                "references": [{k: r[k] for k in ("concept_id", "title", "snippet")} for r in refs]}

    # ---- retrieval & memory
    def _references(self, message: str) -> list[dict[str, Any]]:
        out = []
        for r in search_content(self.s, message, limit=3):
            if r["kind"] != "lesson":
                continue
            cid = r["ref_id"].split("#")[0]
            out.append({"concept_id": cid, "title": r["title"], "snippet": r["snip"], "body": r["body"]})
        return out

    def _memory(self, student_id: str, mentor_id: str) -> MentorMemory:
        mem = self.s.scalar(select(MentorMemory).where(MentorMemory.student_id == student_id,
                                                       MentorMemory.mentor_id == mentor_id, MentorMemory.key == "state"))
        if mem is None:
            mem = MentorMemory(student_id=student_id, mentor_id=mentor_id, key="state", value={"turns": 0, "topics": []})
            self.s.add(mem)
        return mem

    def _remember(self, student_id: str, mentor_id: str, mem: MentorMemory, concept_id: str | None) -> None:
        topics = [t for t in mem.value.get("topics", []) if t != concept_id]
        if concept_id:
            topics.insert(0, concept_id)
        mem.value = {"turns": int(mem.value.get("turns", 0)) + 1, "topics": topics[:10]}
        mem.updated_at = utcnow()

    # ---- deterministic agents
    def _fallback(self, mentor_id, mode, message, refs, concept_id, memory) -> str:
        p = PERSONAS[mentor_id]
        head = f"**Professor {p['name']}** · offline mode (no AI model connected - answers come from the curriculum)\n\n"
        if mode == "coding":
            return head + self._coding(message)
        if mode == "research":
            return head + _RESEARCH
        if not refs:
            return head + ("I could not find that topic in the curriculum yet. Try different keywords (for example "
                           "'learning rate', 'precision recall', 'attention'), or open the district map to browse concepts.")
        concept = self.catalog.concepts[concept_id]
        if mode == "socratic":
            prompts = concept.get("socratic_prompts") or ["What do you already know about this topic?"]
            q = prompts[int(memory.value.get("turns", 0)) % len(prompts)]
            return head + f"Let's reason about **{concept['title']}** together.\n\n> {q}\n\nTake a guess, then check the lesson section: _{refs[0]['snippet']}_"
        body = refs[0]["body"]
        excerpt = body if len(body) < 1400 else body[:1400].rsplit("\n", 1)[0] + "\n…"
        objectives = "\n".join(f"- {o}" for o in concept["objectives"])
        more = "".join(f"\n- {r['title']}: _{r['snippet']}_" for r in refs[1:])
        return (head + f"From the lesson **{concept['title']}**:\n\n{excerpt}\n\n"
                f"**After this concept you should be able to:**\n{objectives}"
                + (f"\n\n**Related passages:**{more}" if more else ""))

    def _coding(self, message: str) -> str:
        found = [name for name in EXCEPTION_GUIDE if re.search(rf"\b{name}\b", message)]
        parts = []
        if found:
            name = found[-1]
            line = re.findall(r'line (\d+)', message)
            parts.append(f"**{name}**{f' (around line {line[-1]})' if line else ''}: {EXCEPTION_GUIDE[name]}")
        code = re.findall(r"```(?:python)?\n(.*?)```", message, re.S)
        if code:
            try:
                ast.parse(code[0])
                parts.append("Your code parses correctly, so the problem is in its behaviour, not its syntax.")
            except SyntaxError as exc:
                parts.append(f"**Syntax error** at line {exc.lineno}: {exc.msg}.")
        parts.append("**Debugging checklist**\n1. Reproduce the failure with the smallest input you can.\n"
                     "2. Read the traceback bottom-up: exception type, then the deepest line in *your* file.\n"
                     "3. Print the values (and `.shape` for arrays) right before the failing line.\n"
                     "4. Compare with a case you can compute by hand.\n5. Fix one thing, re-run the tests.")
        return "\n\n".join(parts)


_RESEARCH = ("**Experiment design template**\n1. *Question*: what exactly do you want to know?\n"
             "2. *Hypothesis*: a falsifiable prediction (\"Adam reaches 95% test accuracy in fewer epochs than SGD on circles\").\n"
             "3. *Variables*: change one thing (independent), measure one thing (dependent), fix everything else - including seeds.\n"
             "4. *Baseline*: the simplest reasonable comparison.\n5. *Repeats*: run several seeds and report mean ± spread.\n"
             "6. *Threats*: data leakage, tuning on the test set, cherry-picked seeds.\n\n"
             "Every NEXORA laboratory run is saved with its full configuration, so you can cite and reproduce it.")
