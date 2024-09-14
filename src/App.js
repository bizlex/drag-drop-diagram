import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import TextField from './components/TextField';
import DiagramField from './components/DiagramField';
import Toolbox from './components/Toolbox';

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ display: 'flex', height: '100vh' }}>
        <div style={{ flex: 1, padding: '10px' }}>
          <h2>Text Field</h2>
          <TextField />
        </div>
        <div style={{ flex: 2, padding: '10px' }}>
          <h2>Diagram Field</h2>
          <DiagramField />
        </div>
        <div style={{ flex: 1, padding: '10px' }}>
          <h2>Toolbox</h2>
          <Toolbox />
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
