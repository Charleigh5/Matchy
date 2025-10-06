import React from 'react';
import { SparklesIcon } from './IconComponents';

interface ImageCardProps {
  imageUrl: string;
  altText: string;
  onClick: () => void;
  isWinner?: boolean;
  isLoser?: boolean;
  isDisabled?: boolean;
}

export const ImageCard: React.FC<ImageCardProps> = ({ imageUrl, altText, onClick, isWinner = false, isLoser = false, isDisabled = false }) => {
  const baseClasses = "relative aspect-square w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-500 transform";
  
  const stateClasses = isDisabled && !isWinner && !isLoser
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer hover:scale-105 hover:shadow-2xl";

  let dynamicClasses = '';
  if (isWinner) {
    dynamicClasses = 'scale-110 z-10 ring-4 ring-green-400 shadow-2xl';
  } else if (isLoser) {
    dynamicClasses = 'opacity-30 scale-90';
  }

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${dynamicClasses}`}
      onClick={!isDisabled ? onClick : undefined}
    >
      <img src={imageUrl} alt={altText} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black bg-opacity-10"></div>
      {isWinner && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Pulsing glow effect */}
            <SparklesIcon className="w-2/3 h-2/3 text-yellow-300 absolute animate-ping opacity-75" />
            {/* Static icon on top */}
            <SparklesIcon className="w-1/2 h-1/2 text-yellow-400 absolute" />
        </div>
      )}
    </div>
  );
};