import React from 'react';
import { useDrag } from 'react-dnd';

const DraggableTool = ({ tool }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'TOOL', // Устанавливаем тип TOOL для инструментов
    item: { tool },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      style={{
        padding: '5px',
        margin: '5px',
        border: '1px solid black',
        cursor: 'move',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {tool}
    </div>
  );
};

export default DraggableTool;
