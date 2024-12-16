import React, { useState } from 'react';
import axios from 'axios';

function FeedbackForm() {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:3000/submit-feedback', {
        rating,
        comments,
      });
      setMessage(response.data.message);
      setRating(0);
      setComments('');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setMessage('Failed to submit feedback. Please try again.');
    }
  };

  return (
    <div className="feedback-form p-6 bg-white rounded-lg shadow-md max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-center">We Value Your Feedback</h2>
      {message && <p className="text-center text-green-500 mb-4">{message}</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium text-gray-700">Rating:</label>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                onClick={() => setRating(star)}
                className={`w-6 h-6 cursor-pointer ${
                  rating >= star ? 'text-yellow-500' : 'text-gray-300'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9.049 2.927C9.362 2.179 10.638 2.179 10.951 2.927l1.54 3.867a1 1 0 00.95.69h4.166c.969 0 1.371 1.24.588 1.81l-3.36 2.435a1 1 0 00-.364 1.118l1.54 3.868c.313.748-.542 1.372-1.214.908l-3.36-2.435a1 1 0 00-1.175 0l-3.36 2.435c-.672.464-1.527-.16-1.214-.908l1.54-3.868a1 1 0 00-.364-1.118L2.706 9.294c-.783-.57-.38-1.81.588-1.81h4.166a1 1 0 00.95-.69l1.54-3.867z" />
              </svg>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium text-gray-700">Comments:</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-base focus:ring-blue-500 focus:border-blue-500"
            rows="4"
          ></textarea>
        </div>
        <button
          type="submit"
          className="w-full text-white bg-gray-900 hover:bg-blue-500 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
        >
          Submit Feedback
        </button>
      </form>
    </div>
  );
}

export default FeedbackForm;
