import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { PlayApp } from './PlayApp'

createRoot(document.getElementById('root')!).render(<StrictMode><PlayApp /></StrictMode>)
