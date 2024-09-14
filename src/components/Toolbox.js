import React from 'react';
import DraggableTool from './DraggableTool';

const Toolbox = () => {
  const tools = ['Line', 'Arrow'];

  return (
    <div style={{ border: '1px solid black', padding: '10px', width: '200px' }}>
      <h3>Toolbox</h3>
      {tools.map((tool, index) => (
        <DraggableTool key={index} tool={tool} />
      ))}
    </div>
  );
};

export default Toolbox;
