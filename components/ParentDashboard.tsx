
import React from 'react';
import { ImageCollection } from '../types';
import { PlayIcon, PlusIcon, StarIcon, EditIcon, TrashIcon } from './IconComponents';

interface ParentDashboardProps {
  collections: ImageCollection[];
  onStartGame: (collection: ImageCollection) => void;
  onNewCollection: () => void;
  onEditCollection: (collection: ImageCollection) => void;
  onDeleteCollection: (id: string) => void;
}

const ComplexityRating: React.FC<{ level: number }> = ({ level }) => (
  <div className="flex items-center" aria-label={`Complexity level ${level} out of 5`}>
    {[...Array(5)].map((_, i) => (
      <StarIcon key={i} className="w-5 h-5 text-yellow-400" filled={i < level} />
    ))}
  </div>
);

export const ParentDashboard: React.FC<ParentDashboardProps> = ({ collections, onStartGame, onNewCollection, onEditCollection, onDeleteCollection }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-700">Your Collections</h2>
        <button
            className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105"
            onClick={onNewCollection}
        >
            <PlusIcon className="w-5 h-5 mr-2" />
            New Collection
        </button>
      </div>
      
      {collections.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">You haven't created any collections yet.</p>
          <p className="text-gray-400 mt-2">Click "New Collection" to get started!</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((collection) => (
          <div key={collection.id} className="bg-white rounded-xl shadow-lg overflow-hidden transition-shadow hover:shadow-2xl flex flex-col">
            <div className="p-5 flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800">{collection.name}</h3>
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-gray-500 text-sm mr-4">{collection.images.length} images</p>
                            <ComplexityRating level={collection.complexity} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <button onClick={() => onEditCollection(collection)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors" aria-label={`Edit ${collection.name}`}>
                            <EditIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDeleteCollection(collection.id)} className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors" aria-label={`Delete ${collection.name}`}>
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            <div className={`grid ${collection.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-1 px-1`}>
              {collection.images.slice(0, 4).map((image, index) => (
                <div key={image.id} className={`aspect-w-1 aspect-h-1 ${collection.images.length > 2 && index > 1 ? 'hidden sm:block' : ''}`}>
                  <img src={image.url} alt={image.names[0]} className="w-full h-full object-cover"/>
                </div>
              ))}
            </div>
            <div className="p-5 bg-gray-50 mt-auto">
              <button
                onClick={() => onStartGame(collection)}
                disabled={collection.images.length < 2}
                className="w-full flex items-center justify-center px-4 py-3 bg-green-500 text-white font-bold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
              >
                <PlayIcon className="w-6 h-6 mr-3" />
                Start Game
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
