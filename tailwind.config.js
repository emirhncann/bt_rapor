/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Modern Header Gradients
    'bg-gradient-to-r', 'from-slate-900', 'via-slate-800', 'to-slate-900',
    'from-blue-400', 'to-purple-500', 'from-blue-500', 'to-cyan-500',
    'from-emerald-500', 'to-teal-500', 'from-purple-500', 'to-violet-500',
    'from-orange-500', 'to-amber-500', 'from-indigo-500', 'to-blue-500',
    'from-red-500', 'to-pink-500', 'from-green-400', 'to-emerald-500',
    'from-red-600', 'to-pink-600', 'from-blue-500', 'to-purple-600',
    'from-white', 'to-slate-200', 'from-slate-300', 'to-white',
    
    // Modern Header Colors
    'text-slate-300', 'text-slate-400', 'text-white', 'text-slate-200',
    'bg-slate-700/50', 'bg-slate-700/25', 'border-slate-700/50', 'border-slate-700',
    'ring-slate-700/50', 'ring-blue-400/50', 'border-slate-900',
    
    // Modern Effects
    'shadow-2xl', 'shadow-slate-900/25', 'shadow-red-500/25',
    'backdrop-blur-sm', 'bg-clip-text', 'text-transparent',
    'group-hover:scale-105', 'group-hover:scale-110', 'group-hover:rotate-12',
    'group-hover:opacity-20', 'group-hover:opacity-10', 'group-hover:opacity-100',
    'group-hover:ring-blue-400/50', 'group-hover:w-3/4',
    
    // Color classes for dynamic tabs
    'bg-blue-100', 'text-blue-700', 'border-blue-200',
    'bg-green-100', 'text-green-700', 'border-green-200',
    'bg-purple-100', 'text-purple-700', 'border-purple-200',
    'bg-orange-100', 'text-orange-700', 'border-orange-200',
    'bg-indigo-100', 'text-indigo-700', 'border-indigo-200',
    // Gradient classes
    'from-blue-50', 'to-blue-100', 'from-green-50', 'to-green-100',
    'from-purple-50', 'to-purple-100', 'from-orange-50', 'to-orange-100',
    'from-indigo-50', 'to-indigo-100', 'from-gray-50', 'to-gray-100',
    // Border classes
    'border-blue-200', 'border-green-200', 'border-purple-200',
    'border-orange-200', 'border-indigo-200', 'border-gray-200',
    // Text color classes
    'text-blue-600', 'text-green-600', 'text-purple-600',
    'text-orange-600', 'text-indigo-600', 'text-gray-600',
    'text-blue-900', 'text-green-900', 'text-purple-900',
    'text-orange-900', 'text-indigo-900', 'text-gray-900',
    'text-blue-500', 'text-green-500', 'text-purple-500',
    'text-orange-500', 'text-indigo-500', 'text-gray-500',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 