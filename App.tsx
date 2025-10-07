
import React, { useState, useEffect, useMemo } from 'react';
import { ParentDashboard } from './components/ParentDashboard';
import { GameScreen } from './components/GameScreen';
import { GameStatus, ImageCollection } from './types';
import { CollectionForm } from './components/CollectionForm';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [selectedCollection, setSelectedCollection] = useState<ImageCollection | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<ImageCollection | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cogniplay-voice') || null;
    } catch (e) {
      console.error("Could not read voice from localStorage", e);
      return null;
    }
  });


  const mockCollections: ImageCollection[] = useMemo(() => [
    {
      id: 'collection-1',
      name: 'High-Contrast Shapes',
      complexity: 1,
      images: [
        { id: 'img-1a', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBkPSJNMCAwaDQwMHY0MDBIMHoiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyMDAiIGN5PSIyMDAiIHI9IjE1MCIgZmlsbD0iIzI2MjYyNiIvPjwvZz48ZGVmcz48Y2xpcFBhdGggaWQ9ImEiPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoNDAwvjQwMEgweiIvPjwvY2xpcFBhdGg+PC9kZWZzPjwvc3ZnPg==', names: ['Circle'] },
        { id: 'img-1b', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBkPSJNMCAwaDQwMHY0MDBIMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNNTAgNTBoMzAwvjMwMEg1MHoiIGZpbGw9IiMyNjI2MjYiLz48L2c+PGRlZnM+PGNsaXBQYXRoIGlkPSJhIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMCAwaDQwMHY0MDBIMHoiLz48L2NsaXBQYXRoPjwvZGVmcz48L3N2Zz4=', names: ['Square'] },
        { id: 'img-1c', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBkPSJNMCAwaDQwMHY0MDBIMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMjAwIDMwIDIzNS4xMTQgMTQ3Ljk3OUg5My43MDZsMTA2Ljg5IDc3LjY0LTQwLjc3MiAxMTcuOTVMOTYgMjQzLjU2MmwxNTguNzIg