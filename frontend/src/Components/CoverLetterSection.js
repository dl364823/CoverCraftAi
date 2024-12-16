import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Navigate, useNavigate } from 'react-router-dom';

function CoverLetterSection({
    resumeText,
    jobDescription,
    selectedSections,
    setSelectedSections,
}) {
    const [options, setOptions] = useState([]);
    const [previousOptions, setPreviousOptions] = useState([]);
    const [currentSection, setCurrentSection] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedOption, setSelectedOption] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const [sectionHistory, setSectionHistory] = useState({});
    const navigate = useNavigate();

    const API_BASE_URL = 'https://covercraftai.onrender.com';

    const steps = [
        { 
            name: 'Open Hook', 
            endpoint: '/generate-open-hook',
            description: 'Create a compelling introduction that grabs attention'
        },
        { 
            name: 'Key Experiences', 
            endpoint: '/generate-key-experiences',
            description: 'Highlight your most relevant achievements'
        },
        { 
            name: 'Personal Values', 
            endpoint: '/generate-personal-values',
            description: 'Connect your values with the company culture'
        },
        { 
            name: 'Closing Statement', 
            endpoint: '/generate-closing-statement',
            description: 'End with a strong call to action'
        },
    ];

    useEffect(() => {
        if (resumeText && jobDescription) {
            // 清空状态
            setOptions([]);
            setPreviousOptions([]);
            setSelectedOption('');
            setError('');
            // 检查是否有历史记录
            const currentStepName = steps[currentStep].name;
            if (sectionHistory[currentStepName]) {
                setOptions(sectionHistory[currentStepName].current || []);
                setPreviousOptions(sectionHistory[currentStepName].previous || []);
                setSelectedOption(sectionHistory[currentStepName].selected || '');
            } else {
                // 如果没有历史记录，生成新的选项
                generateSection();
            }
        }
    }, [currentStep, resumeText, jobDescription]);

    if (!resumeText || !jobDescription) {
        alert('Please upload your resume and enter the job description before proceeding.');
        return <Navigate to="/" replace />;
    }

    const generateSection = async () => {
        const current = steps[currentStep];
        setLoading(true);
        setError('');
        setCurrentSection(current.name);
        setPreviousOptions([]);
        console.log(`Generating options for section: ${current.name}`);

        try {
            const response = await axios.post(`${API_BASE_URL}/${current.endpoint}`, {
                jobDescription,
                resumeText,
            });

            if (response.data && Array.isArray(response.data.options)) {
                setOptions(response.data.options);
                setSectionHistory(prev => ({
                    ...prev,
                    [current.name]: {
                        current: response.data.options,
                        previous: [],
                        selected: ''
                    }
                }));
                setError('');
            } else {
                throw new Error('Invalid response data');
            }
        } catch (error) {
            console.error('Error generating section:', error);
            setError('Failed to generate options. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelection = (optionText, source) => {
        setSelectedOption(optionText);
        setSectionHistory(prev => ({
            ...prev,
            [currentSection]: {
                ...prev[currentSection],
                selected: optionText
            }
        }));
        setError('');
        console.log(`Selected ${source} option for ${currentSection}:`, optionText);
    };

    const handleRegenerateOptions = async () => {
        setPreviousOptions(options);
        setSectionHistory(prev => ({
            ...prev,
            [currentSection]: {
                ...prev[currentSection],
                previous: options
            }
        }));

        const current = steps[currentStep];
        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/${current.endpoint}`, {
                jobDescription,
                resumeText,
            });

            if (response.data && Array.isArray(response.data.options)) {
                setOptions(response.data.options);
                setSectionHistory(prev => ({
                    ...prev,
                    [currentSection]: {
                        ...prev[currentSection],
                        current: response.data.options
                    }
                }));
            }
        } catch (error) {
            console.error('Error regenerating options:', error);
            setError('Failed to generate new options. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const saveSelection = () => {
        if (!selectedOption) {
            setError('Please select an option before proceeding.');
            return;
        }

        const cleanedOption = selectedOption.replace(/^Option \d+:\s*/, '');
        setSelectedSections((prevSections) => ({
            ...prevSections,
            [currentSection]: cleanedOption,
        }));
    };

    const handleNextStep = () => {
        saveSelection();
        if (currentStep < steps.length - 1) {
            setCurrentStep((prevStep) => prevStep + 1);
        } else {
            navigate('/download');
        }
    };

    const OptionCard = ({ item, index, isSelected, onSelect, type }) => (
        <div
            className={`mb-4 p-4 rounded-lg cursor-pointer 
                transition-all duration-300 
                transform hover:scale-[1.02]
                ${isSelected
                    ? 'bg-yellow-100 border-2 border-yellow-400 shadow-md scale-[1.02]'
                    : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md'
                }`}
            onClick={() => onSelect(item.option, type)}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    <input
                        type="radio"
                        name="sectionOption"
                        value={item.option}
                        checked={isSelected}
                        onChange={() => onSelect(item.option, type)}
                        className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 font-semibold text-lg">Option {index + 1}</span>
                </div>
                <span className={`text-sm px-2 py-1 rounded 
                    ${type === 'new' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'}`}
                >
                    {type === 'new' ? 'New' : 'Previous'}
                </span>
            </div>
            <p className="mt-3 text-gray-700">{item.option}</p>
            <div className="mt-3 bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600 italic">
                    <span className="font-medium">Why Choose This:</span> {item.reason}
                </p>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto mt-10 px-4">
            {/* Progress Steps */}
            <div className="flex justify-center mb-10 space-x-4">
                {steps.map((step, index) => (
                    <div key={index} className="flex flex-col items-center">
                        <div
                            className={`w-12 h-12 flex items-center justify-center rounded-full text-lg font-bold 
                                transition-all duration-300
                                ${index <= currentStep
                                    ? 'bg-gray-800 text-white hover:bg-blue-500 transform hover:scale-110'
                                    : 'bg-gray-300 text-gray-500'
                                }`}
                        >
                            {index + 1}
                        </div>
                        <span className="mt-2 text-sm font-medium text-gray-600">
                            {step.name}
                        </span>
                    </div>
                ))}
            </div>

            {/* Section Header */}
            <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold mb-2 transition-all duration-300 
                    ${currentStep === 0 ? 'text-blue-600 transform scale-110' : 'text-gray-800'}`}
                >
                    {steps[currentStep].name}
                </h2>
                <p className="text-gray-600">{steps[currentStep].description}</p>
            </div>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="flex items-center">
                        <svg
                            className="animate-spin h-8 w-8 text-blue-500"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            ></circle>
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v8H4z"
                            ></path>
                        </svg>
                        <span className="ml-3 text-lg text-blue-500">Generating options...</span>
                    </div>
                    <div className="text-sm text-gray-500">
                        Estimated time: 5-10 seconds
                    </div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* New Options Column */}
                    <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-gray-800">New Options</h3>
                            <button
                                onClick={handleRegenerateOptions}
                                disabled={loading}
                                className={`px-4 py-2 text-sm bg-gray-800 text-white rounded-lg 
                                    transition-all duration-200
                                    ${loading 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'hover:bg-blue-600 hover:scale-105'
                                    }`}
                            >
                                {loading ? 'Generating...' : 'Generate More'}
                            </button>
                        </div>
                        <div className="space-y-4">
                            {options.map((item, index) => (
                                <OptionCard
                                    key={`new-${index}`}
                                    item={item}
                                    index={index}
                                    isSelected={selectedOption === item.option}
                                    onSelect={handleSelection}
                                    type="new"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Previous Options Column */}
                    {previousOptions.length > 0 && (
                        <div className="flex-1 bg-white p-6 rounded-xl shadow-lg animate-fadeIn">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">
                                Previous Options
                            </h3>
                            <div className="space-y-4">
                                {previousOptions.map((item, index) => (
                                    <OptionCard
                                        key={`prev-${index}`}
                                        item={item}
                                        index={index}
                                        isSelected={selectedOption === item.option}
                                        onSelect={handleSelection}
                                        type="previous"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleNextStep}
                    disabled={!selectedOption || loading}
                    className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200
                        ${selectedOption && !loading
                            ? 'bg-gray-900 text-white hover:bg-blue-500 transform hover:scale-105'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    {currentStep < steps.length - 1 ? 'Save and Continue' : 'Generate Cover Letter'}
                </button>
            </div>

            <p className="text-sm text-gray-600 text-center mt-4">
                Step {currentStep + 1} of {steps.length}
            </p>

            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    .animate-fadeIn {
                        animation: fadeIn 0.5s ease-in-out;
                    }
                `}
            </style>
        </div>
    );
}

export default CoverLetterSection;