
import React from 'react';

interface ImageCardProps {
  imageUrl: string;
  altText: string;
  onClick: () => void;
  isSelected?: boolean;
  isDisabled?: boolean;
}

export const ImageCard: React.FC<ImageCardProps> = ({ imageUrl, altText, onClick, isSelected = false, isDisabled = false }) => {
  const baseClasses = "relative aspect-square w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 transform";
  const stateClasses = isDisabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer hover:scale-105 hover:shadow-2xl";
  const selectionClasses = isSelected ? "ring-8 ring-offset-4 ring-yellow-400" : "ring-4 ring-transparent";

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${selectionClasses}`}
      onClick={!isDisabled ? onClick : undefined}
    >
      <img src={imageUrl} alt={altText} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black bg-opacity-10"></div>
    </div>
  );
};
