import React from 'react';
import { Link } from 'react-router-dom';

// Lazyloading
const OptimizedImage = ({ src, alt, className = "", ...props }) => (
  <img
      src={src}
      alt={alt}
      loading="lazy" // 添加延迟加载
      className={`${className} transition-transform duration-300`}
      onError={(e) => {
          e.target.src = '/fallback-image.png'; // 添加后备图片
          e.target.onerror = null;
      }}
      {...props}
  />
);

// 1. HeroSection Component
const HeroSection = () => (
  <section className="bg-blue-400 bg-opacity-40  py-24">
    <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center">
      
      {/* 左侧：文本内容 */}
      <div className="lg:w-1/2 mb-12 lg:mb-0">
        <h1 className="text-6xl font-extrabold leading-tight mb-6">
          Generate your Perfect Cover Letter in Minutes
        </h1>
        <p className="text-2xl leading-relaxed mb-8">
          Build high-impact cover letters tailored to the position you’re applying for to stand out to potential employers and get hired in any competitive industry.
        </p>
        <div className="flex flex-col sm:flex-row justify-start space-y-4 sm:space-y-0 sm:space-x-4">
          <Link to="/upload-resume">
            <button className="bg-gray-800 text-white font-semibold py-3 px-8 rounded-full hover:bg-blue-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400">
              Get Started for Free!
            </button>
          </Link>
          <a href="#how-it-works">
            <button className="bg-white text-blue-400  border-white font-semibold py-3 px-8 rounded-full hover:bg-blue-400 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400">
              See How It Works
            </button>
          </a>
        </div>
      </div>
      
      {/* 右侧：视觉内容 */}
      <div className="lg:w-1/2">
        <OptimizedImage
          src= "logo.png"
          alt="Screenshot of Cover Letter Generator Application" 
          className="mx-auto rounded-lg shadow-lg w-full max-w-md transform hover:scale-105 transition-transform duration-300" 
          loading="lazy"
        />
      </div>
    </div>
  </section>
);

// 2. GuideSection Component
const HighlightSection = () => (
  <section id="how-it-features" className="py-16 bg-gray-50">
    <div className="container mx-auto px-6 text-center">
      <h2 className="text-4xl font-bold mb-12">Multiple features for endless benefits</h2>
      <div className="flex flex-wrap -mx-4">
        {/* Steps */}
        {[
          { icon: '⏱️', title: 'Time-Saving', description: 'Speed up your job application process.' },
          { icon: '🔍', title: 'Job & Skill Alignment Table', description: 'Visualize how your resume matches the job description to tailor every application for success.' },
          { icon: '✨', title: 'Customizable Options ', description: 'Explore five expertly tailored suggestions per section to make your strengths shine.' },
          { icon: '🤖', title: 'AI tool', description: 'Finish writing tasks faster and stay in your flow with generative AI.' },
          { icon: '✍️',  title: 'Edit as You Go', description: 'Edit your cover letter directly in the tool with live previews before saving or sharing.'},
          {icon: '📜',  title: 'Professional Formatting', description: 'Download as a Word file or copy in a clean, professional format.'},
        ].map((step, index) => (
          <div key={index} className="w-full md:w-1/2 lg:w-1/3 px-4 mb-8">
            <div className="p-6 hover:bg-blue-100 rounded-lg transition-colors duration-200">
              <div className="text-5xl mb-4">{step.icon}</div>
              <h3 className="font-semibold text-xl mb-2">{step.title}</h3>
              <p className="text-gray-700">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
      <Link to="/upload-resume">
        <button className="mt-8 bg-gray-800 text-white font-semibold py-3 px-6 rounded-full hover:bg-blue-400 transition-colors duration-200">
          Get Started for Free!
        </button>
      </Link>
    </div>
  </section>
);

// MODIFIED: 优化 FeatureCard 组件
const FeatureCard = ({ icon, title, description }) => (
  <div className="w-full md:w-1/2 lg:w-1/3 px-4 mb-8">
      <div className="p-6 hover:bg-blue-100 rounded-lg transition-all duration-200 
          transform hover:scale-105 hover:shadow-lg h-full flex flex-col justify-between
          border border-transparent hover:border-blue-200"> {/* NEW: 添加边框效果 */}
          <div>
              <div className="text-5xl mb-4 transform hover:scale-110 transition-transform duration-200">
                  {icon}
              </div>
              <h3 className="font-semibold text-xl mb-2">{title}</h3>
              <p className="text-gray-700">{description}</p>
          </div>
      </div>
  </div>
);

// MODIFIED: 优化 ScrollingLogos 组件
const ScrollingLogos = ({ logos, direction = "left" }) => {
  const duplicatedLogos = [...logos, ...logos];
  
  return (
      <div className="relative overflow-hidden w-full">
          <div 
              className={`flex items-center space-x-6 ${
                  direction === "left" ? "animate-scroll-left" : "animate-scroll-right"
              } will-change-transform`}
          >
              {duplicatedLogos.map((logo, index) => (
                  <div
                      key={`${logo}-${index}`}
                      className="flex-shrink-0 w-20 h-20 bg-white rounded-lg flex items-center justify-center 
                          shadow-sm transform hover:scale-105 transition-transform duration-200
                          hover:shadow-md" // NEW: 添加悬停效果
                  >
                      <OptimizedImage
                          src={logo}
                          alt={`${logo.split("/").pop().split(".")[0]} logo`}
                          className="w-12 h-12 object-contain"
                      />
                  </div>
              ))}
          </div>
      </div>
  );
};

// 3. ScrollingIconSection Component
const ScrollingIconSection = () => {
  // NEW: 将 logo 数组提取出来
  const leftLogos = [
      "/oracle.png", "/apple.png", "/netflix.png", "/google.png",
      "/microsoft.png", "/amazon.png", "/meta.png", "/tesla.png",
      "/facebook.png", "/nvidia.png", "/tiktok.png"
  ];

  const rightLogos = [
      "/tiktok.png", "/nvidia.png", "/facebook.png", "/tesla.png",
      "/meta.png", "/amazon.png", "/microsoft.png", "/google.png",
      "/apple.png", "/netflix.png", "/oracle.png"
  ];

  return (
      <section className="py-16">
          <div className="container mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-24">
                  <div className="lg:col-span-2 bg-blue-200 bg-opacity-30 border-2 border-gray-800 border-opacity-20 
                      rounded-lg shadow-lg p-8 flex flex-col items-center justify-center
                      transform hover:scale-[1.02] transition-transform duration-300"> {/* NEW: 添加悬停效果 */}
                      <h2 className="text-3xl mb-20 text-center font-bold">
                          No matter which company you are dreaming for...
                      </h2>
                      <div className="space-y-8 w-full">
                          <ScrollingLogos logos={leftLogos} direction="left" />
                          <ScrollingLogos logos={rightLogos} direction="right" />
                      </div>
                  </div>

                  <div className="bg-gray-800 bg-opacity-10 border-2 border-blue-400 border-opacity-40 
                      rounded-lg shadow-lg p-8 flex flex-col items-center justify-center
                      transform hover:scale-[1.02] transition-transform duration-300">
                      <h2 className="text-3xl text-center mb-6 font-bold">
                          ...Always generate perfect cover letter on us.
                      </h2>
                      <OptimizedImage
                          src="/logo.png"
                          alt="Cover Letter Logo"
                          className="w-30 h-30 object-contain"
                      />
                  </div>
              </div>
          </div>

          {/* MODIFIED: 优化动画样式 */}
          <style>
              {`
                  @keyframes scrollLeft {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-50%); }
                  }

                  @keyframes scrollRight {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(50%); }
                  }

                  .animate-scroll-left {
                      animation: scrollLeft 40s linear infinite;
                      will-change: transform;
                  }

                  .animate-scroll-right {
                      animation: scrollRight 40s linear infinite;
                      will-change: transform;
                  }

                  /* NEW: 添加悬停暂停 */
                  .animate-scroll-left:hover,
                  .animate-scroll-right:hover {
                      animation-play-state: paused;
                  }

                  /* NEW: 添加动画渐入效果 */
                  @keyframes fadeIn {
                      from { opacity: 0; }
                      to { opacity: 1; }
                  }

                  .animate-fade-in {
                      animation: fadeIn 1s ease-in;
                  }

                  @media (prefers-reduced-motion: reduce) {
                      .animate-scroll-left,
                      .animate-scroll-right {
                          animation: none;
                      }
                  }
              `}
          </style>
      </section>
  );
};

// 4. GuidenceSection Component
const GuideSection = () => (
    <section id="how-it-works" className="py-16 bg-gray-50">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold text-center mb-12">
          Build a standout cover letter in 4 easy steps
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12">
          {/* Left Column: Illustration */}
          <div className="flex justify-center">
            <OptimizedImage
              src="/guide.png" // Replace with your actual image path
              alt="Cover letter steps illustration"
              className="max-w-lg"
            />
          </div>
  
          {/* Right Column: Steps */}
          <div className="space-y-8">
                    {/* NEW: 提取步骤数据 */}
                    {[
                        {
                            icon: "📊",
                            title: "Upload Your Resume",
                            description: "Simply upload your resume and paste the job description. We'll extract key details to get started."
                        },
                        {
                            icon: "🔍",
                            title: "Get a Skill Match",
                            description: "View a detailed comparison table to identify key alignments between your skills and the job requirements."
                        },
                        {
                            icon: "✍️",
                            title: "Customize Your Cover Letter",
                            description: "Select personalized options for each section—Open Hook, Key Experiences, Personal Values and Closing Statement."
                        },
                        {
                            icon: "📥",
                            title: "Download or Copy",
                            description: "Get a professional, ready-to-use cover letter that you can further edit or use as is."
                        }
                    ].map((step, index) => (
                        <div key={index} className="flex items-start space-x-4 transform hover:scale-105 transition-transform duration-200">
                            <div className="bg-blue-100 border-opacity-40 text-purple-600 font-bold text-xl 
                                w-12 h-12 flex items-center justify-center rounded-full">
                                {step.icon}
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-2">{step.title}</h3>
                                <p className="text-gray-600">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </section>
);

// 5. ComparisonTable Component
const ComparisonTable = () => (
  <section className="bg-gray-100">
    <div className="container mx-auto px-6">
      <h2 className="text-4xl font-bold text-center mb-12">Why Choose Our Tool?</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-2 border-b-2"></th>
              <th className="px-4 py-2 border-b-2">Our Tool</th>
              <th className="px-4 py-2 border-b-2">Generic Tools</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: 'Skill Alignment Analysis', ourTool: '✅', genericTools: '❌' },
              { feature: 'Structured Guidance', ourTool: '✅', genericTools: '⚠️ Limited' },
              { feature: 'Personalized Content', ourTool: '✅', genericTools: '❌' },
            ].map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border px-4 py-2">{row.feature}</td>
                <td className="border px-4 py-2">{row.ourTool}</td>
                <td className="border px-4 py-2">{row.genericTools}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

// 6. FinalCTA Component
const FinalCTA = () => (
  <section className="bg-blue-400 bg-opacity-20 py-16">
    <div className="container mx-auto px-6 text-center">
      <h2 className="text-4xl font-bold mb-4">Ready to land your dream job?</h2>
      <p className="text-xl mb-8">Start creating your personalized cover letter in minutes.</p>
      <Link to="/upload-resume">
        <button className="bg-gray-800 text-white font-semibold py-3 px-6 rounded-full hover:bg-blue-400 transition-colors duration-200">
          Get Started for Free!
        </button>
      </Link>
    </div>
  </section>
);

// 7. Footer Component
const Footer = () => (
  <footer className="bg-gray-800 text-white py-8">
    <div className="container mx-auto px-6">
      <div className="flex flex-col md:flex-row md:justify-between">
        <div className="mb-6 md:mb-0">
          <h3 className="font-bold text-lg mb-2">Cover Letter Generator</h3>
          <p className="text-gray-400">Helping you create the perfect cover letter.</p>
        </div>
        <div className="mb-6 md:mb-0">
          <ul>
            <li><Link to="/about" className="font-semibold mb-2 hover: text-blue">Quick Start</Link></li>
            
          </ul>
        </div>
        {/*<div>
          <h4 className="font-semibold mb-2">Follow Us</h4>
          <div className="flex space-x-4">
            {/* Replace with actual social media links and SVG icons 
            <a href="https://twitter.com/yourprofile" target="_blank" rel="noopener noreferrer">
              <img src="twitter-icon.png" alt="Twitter" className="h-6 w-6" />
            </a>
            <a href="https://linkedin.com/in/yourprofile" target="_blank" rel="noopener noreferrer">
              <img src="linkedin-icon.png" alt="LinkedIn" className="h-6 w-6" />
            </a>
            <a href="https://github.com/yourprofile" target="_blank" rel="noopener noreferrer">
              <img src="github-icon.png" alt="GitHub" className="h-6 w-6" />
            </a>
          </div>
        </div>*/}
      </div>
    </div>
  </footer>
);

// 9. LandingPage Component
function LandingPage() {
  return (
    <div className="bg-white font-sans">
        <HeroSection />
        <HighlightSection />
        <ScrollingIconSection />
        <GuideSection />
        <FinalCTA />
        <Footer />
    </div>
  );
}

export default LandingPage;
