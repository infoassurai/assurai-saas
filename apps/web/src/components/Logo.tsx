export default function Logo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-lg'

  return (
    <span className={`${textSize} font-extrabold tracking-tight inline-flex items-center`}>
      <span className="text-gray-900">ASSUR</span>
      <span className="relative">
        <span className="bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent">AI</span>
        <svg
          className={`absolute -top-1 -right-3 ${size === 'lg' ? 'w-3 h-3' : 'w-2 h-2'} text-cyan-400`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        </svg>
      </span>
    </span>
  )
}
