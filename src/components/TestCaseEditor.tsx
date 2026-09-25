import React, { useState, useEffect } from 'react';
import { saveValidationResult, getAllValidationResults, clearValidationResult } from '../lib/localStorageHandler';

const TestCaseEditor = () => {
  const [code, setCode] = useState('');
  const [savedFunctions, setSavedFunctions] = useState([]);

  useEffect(() => {
    const results = getAllValidationResults();
    setSavedFunctions(results);
  }, []);

  const handleSave = () => {
    const key = `function-${Date.now()}`;
    saveValidationResult(key, { code });
    setSavedFunctions([...savedFunctions, { key, value: { code } }]);
    setCode('');
  };

  const handleDelete = (key) => {
    clearValidationResult(key);
    setSavedFunctions(savedFunctions.filter((func) => func.key !== key));
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Test Case Editor</h2>
      <textarea
        className="w-full h-40 p-2 border rounded"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Write your validation function here..."
      ></textarea>
      <button
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
        onClick={handleSave}
      >
        Save Function
      </button>

      <h3 className="text-lg font-bold mt-4">Saved Functions</h3>
      <ul className="mt-2">
        {savedFunctions.map((func) => (
          <li key={func.key} className="flex justify-between items-center border-b py-2">
            <pre className="text-sm bg-gray-100 p-2 rounded w-full">
              {func.value.code}
            </pre>
            <button
              className="ml-2 px-4 py-2 bg-red-500 text-white rounded"
              onClick={() => handleDelete(func.key)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TestCaseEditor;
