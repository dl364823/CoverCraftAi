import React, { useState } from 'react';
import axios from 'axios';

function QueryForm() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await axios.post('http://localhost:8000/query', { query });
      setResponse(result.data);
      setError(null);
    } catch (err) {
      setError('Error querying the server');
      setResponse(null);
    }
  };

  return (
    <div className="query-form">
      <h2 className="text-xl font-semibold mb-4">Query the Document</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your query here"
          className="border p-2 mb-4 w-full"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2">
          Submit
        </button>
      </form>
      {response && (
        <div className="mt-4">
          <h3 className="font-semibold">Response:</h3>
          <p>Answer: {response.answer}</p>
          <p>Sources: {response.sources.join(', ')}</p>
        </div>
      )}
      {error && <p className="text-red-500 mt-4">{error}</p>}
    </div>
  );
}

export default QueryForm;
