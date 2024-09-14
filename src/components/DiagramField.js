import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import DraggableWord from './DraggableWord';

const DiagramField = () => {
  const [droppedItems, setDroppedItems] = useState([]);

  const [{ isOver }, drop] = useDrop({
    accept: 'WORD',
    drop: (item, monitor) => {
      const offset = monitor.getClientOffset();
      const existingItemIndex = droppedItems.findIndex((el) => el.word === item.word);

      if (existingItemIndex >= 0) {
        // Перемещаем существующий элемент
        const updatedItems = [...droppedItems];
        updatedItems[existingItemIndex] = { ...updatedItems[existingItemIndex], x: offset.x, y: offset.y };
        setDroppedItems(updatedItems);
      } else {
        // Добавляем новый элемент
        setDroppedItems((prevItems) => [
          ...prevItems,
          { ...item, x: offset.x, y: offset.y }
        ]);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop}
      style={{
        width: '100%',
        height: '400px',
        border: '2px solid black',
        backgroundColor: isOver ? 'lightblue' : 'white',
        position: 'relative',
        marginTop: '20px',
      }}
    >
      {droppedItems.map((item, index) => (
        <DraggableWord
          key={index}
          word={item.word}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
          }}
        />
      ))}
    </div>
  );
};

export default DiagramField;
