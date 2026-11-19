import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Group, type Mesh, type MeshStandardMaterial, type Points } from 'three'
import { player } from '../../engine/player'
import { type MachineState, machineState, prefersReducedMotion, subscribeSimEvents, triggerShake } from '../../engine/simEvents'

export interface NpcSpec { id: string; name: string; role: string; color: string; x: number; z: number }

export const MACHINE = { x: -7, z: 7.5 }  // left of the plaza so it stays visible beside the docked onboarding panel
export const NPCS: NpcSpec[] = [
  { id: 'nova', name: 'Professor Nova', role: 'Welcome guide', color: '#f472b6', x: -3.4, z: 11.5 },
  { id: 'atlas', name: 'Professor Atlas', role: 'Mathematics', color: '#2dd4bf', x: -16.6, z: -8.2 },
  { id: 'newton', name: 'Professor Newton', role: 'Machine Learning', color: '#38bdf8', x: 4.2, z: -23.6 },
  { id: 'neural', name: 'Professor Neural', role: 'Deep Learning', color: '#a78bfa', x: 16.6, z: -8.2 },
]

