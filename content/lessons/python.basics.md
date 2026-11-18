# Python Fundamentals

Python is the working language of AI engineering. Almost every library you will use in NEXORA — NumPy, scikit-learn, PyTorch, FastAPI — is driven from Python.

## Values, names and types

A *name* refers to a *value*. Values have types: `int`, `float`, `str`, `bool`, `list`, `dict`, `tuple`, `None`.

```python
learning_rate = 0.01      # float
epochs = 20               # int
model_name = "classifier" # str
```

Names are references, not boxes. After `y = x`, both names point to the **same** object, so mutating a list through `y` is visible through `x`.

## Functions

Functions turn repeated logic into a named, testable unit. Default arguments make common cases short.

```python
def scale(values, factor=2):
    """Return a new list with every value multiplied by factor."""
    return [v * factor for v in values]
```

Always prefer functions that **return** results over functions that print them — returned values can be tested.

## Control flow

`if/elif/else` chooses, `for` iterates over any iterable, `while` repeats until a condition fails.

```python
for epoch in range(epochs):
    if epoch % 5 == 0:
        print("checkpoint", epoch)
```

## Collections

| Type | Ordered | Mutable | Typical use |
|------|---------|---------|-------------|
| `list` | yes | yes | sequences of samples |
| `tuple` | yes | no | fixed records, shapes like `(32, 3)` |
| `dict` | insertion order | yes | lookup by key in average O(1) |
| `set` | no | yes | membership tests, deduplication |

Dictionary keys are unique: writing a key twice keeps only the last value.

## Comprehensions

`[x * x for x in range(4)]` builds `[0, 1, 4, 9]`. Comprehensions are concise and fast for transforming data.

## Errors are information

Read tracebacks bottom-up: the last line names the exception, the lines above show where it happened. Engineers *expect* errors and use them to locate faulty assumptions.

## Engineering habit

Write small functions, test them with known inputs, and only then compose them. The **Python Fundamentals** mission checks exactly this with automated tests.
