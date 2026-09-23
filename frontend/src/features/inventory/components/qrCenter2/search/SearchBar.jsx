export default function SearchBar({ value, onChange, placeholder }) {
    return (
        <div className="relative mt-4 sm:mt-5">
            <svg className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-emerald-600 sm:left-5" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoComplete="off"
                placeholder={placeholder}
                className="w-full rounded-[13px] border-2 border-emerald-200 bg-emerald-50 py-3.5 pr-3.5 pl-11 font-mono text-base text-slate-900 outline-none placeholder:font-sans placeholder:text-sm placeholder:text-emerald-700/55 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 sm:py-[18px] sm:pr-5 sm:pl-[52px] sm:placeholder:text-[15px]"
            />
        </div>
    );
}
