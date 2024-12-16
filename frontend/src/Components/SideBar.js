import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function SideBar({ resumeText, jobDescription, matchedSkills, selectedSections }) {
  const location = useLocation();

  // Determine if each step is accessible based on the application state
  const isUploadCompleted = resumeText && jobDescription;
  const isComparisonCompleted = matchedSkills && matchedSkills.length > 0;
  const requiredSections = ['Open Hook', 'Key Experiences', 'Personal Values', 'Closing Statement'];
  const isCoverLetterSectionsCompleted = requiredSections.every(
    (section) => selectedSections && selectedSections[section]
  );

  // Define navigation items with their accessibility conditions
  const navItems = [
    {
      name: 'Step 1: Upload Resume',
      path: '/upload-resume',
      isAccessible: true,
    },
    {
      name: 'Step 2: Job & Skill Comparison',
      path: '/comparison',
      isAccessible: isUploadCompleted,
    },
    {
      name: 'Step 3: Customize Cover Letter',
      path: '/cover-letter-section',
      isAccessible: isComparisonCompleted,
    },
    {
      name: 'Step 4: Download Final Cover Letter',
      path: '/download',
      isAccessible: isCoverLetterSectionsCompleted,
    },
  ];

  return (
    <aside className="fixed top-0 left-0 w-64 h-screen bg-gray-800 text-white pt-6">
      <div className="flex items-center justify-center mb-8">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" className="h-8 mr-2" alt="Logo" />
          <span className="text-2xl font-semibold">Cover Letter Generator</span>
        </Link> 
      </div>
      <nav>
        <ul>
          {navItems.map((item) => (
            <li key={item.name}>
              {item.isAccessible ? (
                // Render as a clickable link if the step is accessible
                <Link
                  to={item.path}
                  className={`block py-3 px-4 mb-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    location.pathname === item.path
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {item.name}
                </Link>
              ) : (
                // Render as a non-clickable span if the step is not accessible
                <span
                  className="block py-3 px-4 mb-2 text-sm font-medium rounded-lg text-gray-500 cursor-not-allowed"
                >
                  {item.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default SideBar;
