import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Studio } from './studio/Studio'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
)
