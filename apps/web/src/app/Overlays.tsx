import { useApp } from '../stores/app'
import { Dashboard, MapPanel, PausePanel, SettingsPanel } from '../components/dashboard/Dashboard'
import { DistrictPanel, GatePanel } from '../components/laboratories/DistrictPanel'
import { AssessmentPanel, LessonPanel } from '../components/laboratories/LessonPanel'
import { MentorChat } from '../components/mentors/MentorChat'
import { MissionBoard, MissionWorkspace } from '../components/missions/Missions'
import { ProjectsPanel } from '../components/missions/Projects'
import { LabPanel } from '../components/simulations/Labs'
import { ChallengeBoard, ChallengePanel } from '../components/engagement/Challenges'
import { DailyDebug } from '../components/engagement/Daily'
import { Onboarding } from '../components/engagement/Onboarding'
import { ProfessorDialog } from '../components/engagement/ProfessorDialog'
import { ProgressPanel } from '../components/engagement/Progress'
import { ShareDialog } from '../components/engagement/ShareDialog'

/** Renders the top-most overlay. 2D professional interfaces layered over the 3D campus. */
export default function Overlays() {
  const top = useApp((s) => s.overlays[s.overlays.length - 1])
  if (!top) return null
  switch (top.kind) {
    case 'district': return <DistrictPanel id={top.id} />
    case 'gate': return <GatePanel id={top.id} />
    case 'lesson': return <LessonPanel conceptId={top.conceptId} />
    case 'assessment': return <AssessmentPanel conceptId={top.conceptId} />
    case 'lab': return <LabPanel simId={top.simId} />
    case 'missions': return <MissionBoard />
    case 'mission': return <MissionWorkspace missionId={top.missionId} />
    case 'mentor': return <MentorChat mentorId={top.mentorId} prompt={top.prompt} />
    case 'dashboard': return <Dashboard />
    case 'map': return <MapPanel />
    case 'settings': return <SettingsPanel />
    case 'projects': return <ProjectsPanel />
    case 'pause': return <PausePanel />
    case 'onboarding': return <Onboarding />
    case 'challenges': return <ChallengeBoard lab={top.lab} />
    case 'challenge': return <ChallengePanel id={top.id} />
    case 'share': return <ShareDialog card={top.card} refId={top.ref} text={top.text} />
    case 'progress': return <ProgressPanel />
    case 'daily': return <DailyDebug />
    case 'professor': return <ProfessorDialog id={top.id} />
  }
}
