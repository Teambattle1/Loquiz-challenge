import React from 'react';
import { useLang, Lang } from '../lib/i18n';

const DanishFlag: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 28 20" className={className} aria-hidden="true">
        <rect width="28" height="20" fill="#C8102E" />
        <rect x="9" width="3" height="20" fill="#fff" />
        <rect y="8" width="28" height="3" fill="#fff" />
    </svg>
);

const BritishFlag: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
        <rect width="30" height="20" fill="#012169" />
        <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" strokeWidth="3" />
        <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="1.5" />
        <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="5" />
        <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3" />
    </svg>
);

const LanguageToggle: React.FC = () => {
    const [lang, setLang] = useLang();

    const pick = (l: Lang) => () => setLang(l);

    return (
        <div className="fixed top-3 right-3 z-50 flex items-center gap-1 bg-black/80 border border-orange-500/30 rounded-full p-1 shadow-2xl backdrop-blur-sm">
            <button
                onClick={pick('da')}
                aria-label="Dansk"
                title="Dansk"
                className={`w-8 h-6 rounded-full overflow-hidden border transition-all ${
                    lang === 'da' ? 'border-orange-400 scale-110 shadow-[0_0_10px_rgba(234,88,12,0.5)]' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
            >
                <DanishFlag className="w-full h-full object-cover" />
            </button>
            <button
                onClick={pick('en')}
                aria-label="English"
                title="English"
                className={`w-8 h-6 rounded-full overflow-hidden border transition-all ${
                    lang === 'en' ? 'border-orange-400 scale-110 shadow-[0_0_10px_rgba(234,88,12,0.5)]' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
            >
                <BritishFlag className="w-full h-full object-cover" />
            </button>
        </div>
    );
};

export default LanguageToggle;
