import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const TestLibrary = ({ onTestSelect }) => {
  const [tests, setTests] = useState([]);
  const [newTest, setNewTest] = useState({ name: '', script: '', tags: '' });

  useEffect(() => {
    const savedTests = JSON.parse(localStorage.getItem('testLibrary') || '[]');
    setTests(savedTests);
  }, []);

  const saveTests = (updatedTests) => {
    setTests(updatedTests);
    localStorage.setItem('testLibrary', JSON.stringify(updatedTests));
  };

  const addTest = () => {
    if (newTest.name.trim() && newTest.script.trim()) {
      const updatedTests = [...tests, { ...newTest, id: Date.now().toString() }];
      saveTests(updatedTests);
      setNewTest({ name: '', script: '', tags: '' });
    }
  };

  const deleteTest = (id) => {
    const updatedTests = tests.filter((test) => test.id !== id);
    saveTests(updatedTests);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Test Library</h2>
      <div className="space-y-2">
        <Input
          placeholder="Test Name"
          value={newTest.name}
          onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
        />
        <Textarea
          placeholder="Test Script"
          value={newTest.script}
          onChange={(e) => setNewTest({ ...newTest, script: e.target.value })}
        />
        <Input
          placeholder="Tags (comma-separated)"
          value={newTest.tags}
          onChange={(e) => setNewTest({ ...newTest, tags: e.target.value })}
        />
        <Button onClick={addTest} className="bg-blue-500 text-white">Add Test</Button>
      </div>
      <div className="space-y-4">
        {tests.map((test) => (
          <div key={test.id} className="p-4 border rounded-md">
            <h3 className="font-medium">{test.name}</h3>
            <p className="text-sm text-gray-600">{test.tags}</p>
            <pre className="bg-gray-100 p-2 rounded text-sm">{test.script}</pre>
            <div className="flex justify-end gap-2">
              <Button onClick={() => onTestSelect(test)} className="bg-green-500 text-white">Use</Button>
              <Button onClick={() => deleteTest(test.id)} className="bg-red-500 text-white">Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestLibrary;
