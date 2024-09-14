import React, { useState } from 'react';
import DraggableWord from './DraggableWord';

const TextField = () => {
  const [words, setWords] = useState(['In', 'the', 'beginning']);

  const handleWordDrop = (droppedWord) => {
    // Убираем слово из списка после перемещения
    setWords((prevWords) => prevWords.filter((word) => word !== droppedWord));
  };

  return (
    <div>
      <textarea
        value={words.join(' ')}
        onChange={(e) => setWords(e.target.value.split(' '))}
        placeholder="Enter the text"
        style={{ width: '100%', height: '100px' }}
      />
      {words.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {words.map((word, index) => (
            <DraggableWord key={index} word={word} onDrop={handleWordDrop} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TextField;
