import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

function ComparisonTable({ matchedSkills }) {
    const navigate = useNavigate();

    if (!matchedSkills || matchedSkills.length === 0) {
        alert('Please upload your resume and enter the job description before proceeding.');
        return <Navigate to="/" replace />;
      }
    
    const getRowStyle = (matchLevel) => {
        switch (matchLevel) {
            case 'High':
                return "bg-green-200"; 
            case 'Medium':
                return "bg-yellow-200"; 
            case 'Low':
                return "bg-red-200"; 
            default:
                return "";
        }
    };

    const getMatchLevelIcon = (matchLevel) => {
        switch (matchLevel) {
            case 'High':
                return <span title="Highly Matched" className="text-green-600 font-semibold">✔️</span>;
            case 'Medium':
                return <span title="Relatively Matched" className="text-yellow-600 font-semibold">⚠️</span>;
            case 'Low':
                return <span title="No Match" className="text-red-600 font-semibold">❌</span>;
            default:
                return <span className="text-gray-500">-</span>;
        }
    };
    
    const countHighMatches = () => matchedSkills.filter(skill => skill.matchLevel === 'High').length;
    const totalSkills = matchedSkills.length;
    

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md mt-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Skills Match: <span className="text-green-600 font-bold">{countHighMatches()}</span> / {totalSkills}</h2>
            <div className="mt-4">
                <p><span className="bg-green-200 px-2 py-1 rounded">Highly Matched</span> - High matching skills</p>
                <p><span className="bg-yellow-200 px-2 py-1 rounded">Relatively Matched</span> - Medium matching skills</p>
                <p><span className="bg-red-200 px-2 py-1 rounded">No Match</span> - No relevant skills found</p>
            </div>
            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left">Job Requirement</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Relevant Skills / Experience</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Match Level</th>
                    </tr>
                </thead>
                <tbody>
                    {matchedSkills.map((item, index) => (
                        <tr key={index} className={`${getRowStyle(item.matchLevel)} border border-gray-300`}>
                            <td className="px-4 py-2">{item.jobRequirement}</td>
                            <td className="px-4 py-2">{item.relevantExperience}</td>
                            <td className="px-4 py-2 flex items-center space-x-2">
                                {getMatchLevelIcon(item.matchLevel)} 
                                <span className="font-semibold">{item.matchLevel}</span> 
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button 
                onClick={() => navigate('/cover-letter-section')} 
                className="mt-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-blue-400"
            >
                Proceed to Cover Letter Section
            </button>
        </div>
    );
}

export default ComparisonTable;
