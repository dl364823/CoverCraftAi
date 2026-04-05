import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

function CoverLetterSection({
    resumeText,
    jobDescription,
    selectedSections,
    setSelectedSections,
}) {
    const [options, setOptions] = useState([]);
    const [previousOptions, setPreviousOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    // streamingText accumulates raw tokens so the user sees text appear in real-time
    const [streamingText, setStreamingText] = useState('');
    // ttftInfo holds the measured Time-To-First-Token for display
    const [ttftInfo, setTtftInfo] = useState(null);
    const [error, setError] = useState('');
    const [selectedOption, setSelectedOption] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const [sectionHistory, setSectionHistory] = useState({});
    // abortControllerRef lets us cancel an in-flight stream when the user navigates
    const abortControllerRef = useRef(null);
    const navigate = useNavigate();

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL?.replace(/\/+$/, '') || '';

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

    // Cancel any in-flight stream when the component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    function parseJSONResponse(text) {
        const cleaned = text.replace(/```(json)?/gi, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!parsed.options || !Array.isArray(parsed.options)) {
            throw new Error("Response missing 'options' array.");
        }
        return parsed;
    }

    /**
     * generateSectionStreaming — core streaming engine
     *
     * Connects to /generate-section-stream via fetch + ReadableStream (SSE over POST).
     * Measures TTFT on the client side and implements exponential-backoff reconnection:
     *   - On disconnect, waits 1s then 2s before giving up
     *   - Preserves already-accumulated partial text across retries so the user
     *     sees progress is not lost (connection state recovery)
     *
     * @param {string} sectionName - Which section to generate
     * @param {number} retryCount  - How many retries have been attempted
     * @param {string} partialContent - Content accumulated before a disconnect
     */
    const generateSectionStreaming = async (sectionName, retryCount = 0, partialContent = '') => {
        // Cancel any previous in-flight request for this section
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        // Mark when the request left the client — used to compute end-to-end TTFT
        const requestStartTime = performance.now();
        let firstTokenTime = null;
        let accumulatedContent = partialContent;

        setLoading(true);
        setError('');

        if (retryCount === 0) {
            setStreamingText('');
            setTtftInfo(null);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/generate-section-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sectionName, jobDescription, resumeText }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (!response.body) throw new Error('No response body — streaming not supported');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            // buffer holds any partial SSE line that spans two network chunks
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                // SSE lines are separated by '\n'; keep the last (possibly incomplete) line in buffer
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (raw === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(raw);

                        if (parsed.type === 'ttft') {
                            // Server reports its own TTFT; we add client-side network latency
                            const clientTTFT = performance.now() - requestStartTime;
                            console.log(
                                `[TTFT] Client: ${clientTTFT.toFixed(0)}ms | ` +
                                `Server: ${parsed.ms}ms | ` +
                                `Network overhead: ${(clientTTFT - parsed.ms).toFixed(0)}ms`
                            );
                            setTtftInfo({ client: Math.round(clientTTFT), server: parsed.ms });

                        } else if (parsed.type === 'token') {
                            if (!firstTokenTime) {
                                firstTokenTime = performance.now();
                                console.log(
                                    `[TTFT] First token rendered: ${(firstTokenTime - requestStartTime).toFixed(0)}ms`
                                );
                            }
                            accumulatedContent += parsed.content;
                            // Trigger a React re-render with each token — this is what makes
                            // text "stream" visibly in the UI
                            setStreamingText(accumulatedContent);

                        } else if (parsed.type === 'error') {
                            throw new Error(parsed.message);
                        }
                    } catch (parseErr) {
                        // Malformed JSON in an SSE line — skip it
                    }
                }
            }

            // Stream complete — now parse the accumulated JSON into structured options
            const result = parseJSONResponse(accumulatedContent);
            const totalTime = performance.now() - requestStartTime;
            console.log(
                `[STREAM_COMPLETE] "${sectionName}" — ` +
                `Total: ${totalTime.toFixed(0)}ms | ` +
                `TTFT: ${firstTokenTime ? (firstTokenTime - requestStartTime).toFixed(0) : 'N/A'}ms`
            );

            setOptions(result.options);
            setSectionHistory(prev => ({
                ...prev,
                [sectionName]: { current: result.options, previous: [], selected: '' }
            }));
            setStreamingText('');

        } catch (err) {
            if (err.name === 'AbortError') return; // Intentional cancel, not an error

            console.error(`[STREAM_ERROR] "${sectionName}" (attempt ${retryCount + 1}):`, err.message);

            // Connection state recovery: retry up to 2 times with exponential backoff.
            // Pass accumulatedContent so the UI shows the partial text rather than a blank screen.
            if (retryCount < 2) {
                const delay = 1000 * (retryCount + 1); // 1s, then 2s
                console.log(
                    `Reconnecting in ${delay}ms — ` +
                    `${accumulatedContent.length} chars preserved from partial stream`
                );
                setError(`Connection interrupted. Reconnecting... (attempt ${retryCount + 1}/2)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return generateSectionStreaming(sectionName, retryCount + 1, accumulatedContent);
            }

            setError('Failed to generate options. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (resumeText && jobDescription) {
            setOptions([]);
            setPreviousOptions([]);
            setSelectedOption('');
            setError('');
            setStreamingText('');
            setTtftInfo(null);

            const currentStepName = steps[currentStep].name;
            if (sectionHistory[currentStepName]) {
                setOptions(sectionHistory[currentStepName].current || []);
                setPreviousOptions(sectionHistory[currentStepName].previous || []);
                setSelectedOption(sectionHistory[currentStepName].selected || '');
            } else {
                generateSectionStreaming(currentStepName);
            }
        }
    }, [currentStep, resumeText, jobDescription]);

    if (!resumeText || !jobDescription) {
        alert('Please upload your resume and enter the job description before proceeding.');
        return <Navigate to="/" replace />;
    }

    const handleSelection = (optionText, source) => {
        setSelectedOption(optionText);
        setSectionHistory(prev => ({
            ...prev,
            [steps[currentStep].name]: {
                ...prev[steps[currentStep].name],
                selected: optionText
            }
        }));
        setError('');
    };

    const handleRegenerateOptions = async () => {
        setPreviousOptions(options);
        setSectionHistory(prev => ({
            ...prev,
            [steps[currentStep].name]: {
                ...prev[steps[currentStep].name],
                previous: options
            }
        }));
        setOptions([]);
        await generateSectionStreaming(steps[currentStep].name);
    };

    const saveSelection = () => {
        if (!selectedOption) {
            setError('Please select an option before proceeding.');
            return;
        }
        const cleanedOption = selectedOption.replace(/^Option \d+:\s*/, '');
        setSelectedSections(prevSections => ({
            ...prevSections,
            [steps[currentStep].name]: cleanedOption,
        }));
    };

    const handleNextStep = () => {
        saveSelection();
        if (!selectedOption) return;
        if (currentStep < steps.length - 1) {
            setCurrentStep(prevStep => prevStep + 1);
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
            onClick={() => onSelect(item.paragraph, type)}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    <input
                        type="radio"
                        name="sectionOption"
                        value={item.paragraph}
                        checked={isSelected}
                        onChange={() => onSelect(item.paragraph, type)}
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
            <p className="mt-3 text-gray-700">{item.paragraph}</p>
            <div className="mt-3 bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600 italic">
                    <span className="font-medium">Why Choose This:</span> {item.explanation}
                </p>
            </div>
        </div>
    );

    // Streaming preview: shown while tokens are arriving, before JSON is fully assembled
    const StreamingPreview = () => (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm font-medium text-blue-600">Generating...</span>
                </div>
                {ttftInfo && (
                    <span className="text-xs text-gray-400 font-mono">
                        TTFT: {ttftInfo.client}ms
                    </span>
                )}
            </div>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                {streamingText}
                <span className="animate-pulse">▌</span>
            </pre>
        </div>
    );

    const isStreaming = loading && streamingText.length > 0;
    const isWaiting = loading && streamingText.length === 0;

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

            {/* Waiting for first token: show spinner */}
            {isWaiting && (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="flex items-center">
                        <svg
                            className="animate-spin h-8 w-8 text-blue-500"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="ml-3 text-lg text-blue-500">Connecting to AI...</span>
                    </div>
                    <div className="text-sm text-gray-500">Waiting for first token...</div>
                </div>
            )}

            {/* Streaming: tokens arriving — show live preview */}
            {isStreaming && (
                <div className="flex flex-col gap-6">
                    <StreamingPreview />
                </div>
            )}

            {/* Done: show option cards */}
            {!loading && options.length > 0 && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* New Options Column */}
                    <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">New Options</h3>
                                {ttftInfo && (
                                    <p className="text-xs text-gray-400 font-mono mt-1">
                                        First token: {ttftInfo.client}ms
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleRegenerateOptions}
                                disabled={loading}
                                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg
                                    transition-all duration-200 hover:bg-blue-600 hover:scale-105"
                            >
                                Generate More
                            </button>
                        </div>
                        <div className="space-y-4">
                            {options.map((item, index) => (
                                <OptionCard
                                    key={`new-${index}`}
                                    item={item}
                                    index={index}
                                    isSelected={selectedOption === item.paragraph}
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
                                        isSelected={selectedOption === item.paragraph}
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
