import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard       from './pages/Dashboard'
import History         from './pages/History'
import Calculator      from './pages/Calculator'
import FailureDatabase from './pages/FailureDatabase'
import OrbitPage       from './pages/OrbitPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Dashboard />}       />
        <Route path="/history"           element={<History />}         />
        <Route path="/calculator"        element={<Calculator />}      />
        <Route path="/failures"          element={<FailureDatabase />} />
        <Route path="/orbit/:launchId"   element={<OrbitPage />}       />
      </Routes>
    </BrowserRouter>
  )
}
