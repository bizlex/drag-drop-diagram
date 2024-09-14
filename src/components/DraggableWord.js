import React from 'react';
import { useDrag } from 'react-dnd';

const DraggableWord = ({ word, onDrop, style }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'WORD',
    item: { word },
    end: (item, monitor) => {
      if (monitor.didDrop() && onDrop) {
        onDrop(item.word);
      }
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  return (
    <span
      ref={drag}
      style={{
        padding: '5px',
        margin: '5px',
        border: '1px solid black',
        cursor: 'move',
        opacity: isDragging ? 0.5 : 1,
        ...style,
      }}
    >
      {word}
    </span>
  );
};

export default DraggableWord;
