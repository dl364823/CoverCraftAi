import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import UploadResume from './Components/UploadResume';
import ComparisonTable from './Components/ComparisonTable';
import CoverLetterSection from './Components/CoverLetterSection';
import DownloadCoverLetter from './Components/DownloadCoverLetter';
import SideBar from './Components/SideBar';
import LandingPage from './Components/LandingPage';
import QueryForm from './Components/QueryForm';

function App() {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [matchedSkills, setMatchedSkills] = useState([]);
  const [selectedSections, setSelectedSections] = useState({});
  const [coverLetter, setCoverLetter] = useState('');

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow">
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Main App Routes with Sidebar */}
            <Route
              path="*"
              element={
                <div className="flex">
                  {/* Sidebar is fixed for all app routes */}
                  <SideBar
                    resumeText={resumeText}
                    jobDescription={jobDescription}
                    matchedSkills={matchedSkills}
                    selectedSections={selectedSections}
                  />
                  <div className="ml-64 p-4 w-full">
                    <h1 className="text-2xl font-semibold mb-4 text-center">
                      Let's create a unique Cover Letter for your ideal job!
                    </h1>
                    <Routes>
                      <Route
                        path="/upload-resume"
                        element={
                          <UploadResume
                            setResumeText={setResumeText}
                            setJobDescription={setJobDescription}
                            setMatchedSkills={setMatchedSkills}
                          />
                        }
                      />
                      <Route
                        path="/comparison"
                        element={
                          <ComparisonTable matchedSkills={matchedSkills} />
                        }
                      />
                      <Route
                        path="/cover-letter-section"
                        element={
                          <CoverLetterSection
                            resumeText={resumeText}
                            jobDescription={jobDescription}
                            selectedSections={selectedSections}
                            setSelectedSections={setSelectedSections}
                          />
                        }
                      />
                      <Route
                        path="/download"
                        element={
                          <DownloadCoverLetter
                            selectedSections={selectedSections}
                            coverLetter={coverLetter}
                            setCoverLetter={setCoverLetter}
                            resumeText={resumeText}
                          />
                        }
                      />
                      <Route
                        path="/query"
                        element={<QueryForm />}
                      />
                    </Routes>
                  </div>
                </div>
              }
            />
          </Routes>
          </div>
          {/* Footer - Moved outside <Routes> */}
          <div className="mt-8 text-center text-gray-500">
            &copy; {new Date().getFullYear()} Cover Letter Generator. All rights reserved.
          </div>
        </div>
    </Router>
  );
}

export default App;
