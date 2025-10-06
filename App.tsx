
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
        { id: 'img-1c', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBkPSJNMCAwaDQwMHY0MDBIMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMjAwIDMwIDIzNS4xMTQgMTQ3Ljk3OUg5My43MDZsMTA2Ljg5IDc3LjY0LTQwLjc3MiAxMTcuOTVMOTYgMjQzLjU2MmwxNTguNzIgMTE1LjIzIDQwLjc3Mi0xMTcuOTVMMjAwIDMwWiIgZmlsbD0iIzI2MjYyNiIvPjwvZz48ZGVmcz48Y2xpcFBhdGggaWQ9ImEiPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoNDAwvjQwMEgweiIvPjwvY2xipFBhdGg+PC9kZWZzPjwvc3ZnPg==', names: ['Star'] },
        { id: 'img-1d', url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBkPSJNMCAwaDQwMHY0MDBIMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMjAwIDM1NGMtMTAtMjQtMTYwLTEzMy0xNjAtMjI0IDAtNTYgNDAtODggOTAtODggNDAgMCA3MCAzMiA3MCAzMiA1MS00MSA5MC0zMiA5MC0zMiA1MCAwIDkwIDMyIDkwIDg4IDAgOTEgLTE1MCAyMDAtMTYwIDIyNFoiIGZpbGw9IiMyNjI2MjYiLz48L2c+PGRlZnM+PGNsaXBQYXRoIGlkPSJhIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMCAwaDQwMHY0MDBIMHoiLz48L2NsaXBQYXRoPjwvZGVmcz48L3N2Zz4=', names: ['Heart'] },
      ],
    },
    {
      id: 'collection-2',
      name: 'Friendly Animal Faces',
      complexity: 1,
      images: [
        { id: 'img-2a', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjRkZENzAwIiBkPSJNNzguMSAyMi43Yy0uMi0zLjItMS4xLTUuNi0yLjYtNy4yLTIuOS0zLTcuMy0zLjQtMTEuNS0zLjRzLTguNi40LTExLjUgMy40Yy0xLjUgMS42LTIuNCA0LTIuNiA3LjJMMzYuOSA2NGMyMy41IDE3LjQgNDEuMiAxMy40IDQxLjIgMTMuNEw2MCAzNmw2LjkgMTMuNGMxLjkgMy43IDQuNyA2LjYgOCA3LjdsMTMuMyA1LjUgMTQtMy42YzAgMC00LjYgMTcuMS0yMiAxMy45TDc4LjEgMjIuN3oiLz48cGF0aCBmaWxsPSIjMkQyNzI4IiBkPSJNNjMuMyAzNS4xYzAgMS0uOSAxLjgtMiAxLjhzLTIgLjgtMi0xLjggMC0xLjguOS0xLjggMi0uOSAyIC45em0tMTcuMiAxLjhjLTEuMSAwLTIgLjgtMiAxLjhzLjkgMS44IDIgMS44IDItLjggMi0xLjgtLjktMS44LTItMS44eiIvPjxwYXRoIGQ9Ik01MS45IDQzLjNjLTEuMS0xLjctMi43LTIuOS00LjYtMy40LTMtLjgtNi4zLjItNy44IDMuMWwtOC42IDQuNGMtMi49IDMuNS40IDguNSA1IDcuOGwyMi4xLTMuNGMxLjktLjMgMy40LTEuNSA0LTMuNCAzLjUtNC43LTEuMy0xMC4yLTQuOC04LjFMNTEuOSA0My4zeiIgZmlsbD0iIzJEMjcyOCIvPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik02My4zIDM1LjFjMC0xLjEgLjktMS45IDItMS45czIgLjggMiAxLjljMCAxLS45IDEuOC0yIDEuOHMtMi0uOC0yLTEuOHptLTE3LjIgMGMwLTEuMS45LTEuOSA1LTEuOXMyIC44IDIgMS45YzAgMS0uOSAxLjgtMiAxLjhTMzQuMyAzNi4xIDM0LjMgMzUuMXoiLz48cGF0aCBmaWxsPSIjRkZBN0E3IiBkPSJNNTEuMSA0Ny45Yy0xLjIgMC0yLjEtLjItMy0uNi0xLjJoLjUtMi0xLjQtMi4xLTIuNmwtLjItMi44YzAtLjYuMy0xLjEuOC0xLjRsMi42LTEuNGMxLjQtLjcgMy4xLS40IDQuMSAxLjEgMSAxLjUgLjcgMy4zLS44IDQuMmwtLjYgLjVjLS42LjMtMS4yLjUtMS45LjZ6Ii8+PC9zdmc+', names: ['Cat', 'Kitty'] },
        { id: 'img-2b', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjQ0Q4NzVGIiBkPSJNMzYuNiA0MS45QzE2LjUgNDUuOCAxMy4yIDgxLjkgMzEuOCA5Mi40YzE4LjYgMTAuNSA0NS45LjggNTEuNS0xOS4yUzgwLjkgMjguMSAzNi42IDQxLjl6Ii8+PHBhdGggZmlsbD0iI0ZGRkZGRiIgZD0iTTE2LjggMzguOGMtMTEuMyAxLjQtMTMuOCA4LjItMTAuOCAxNC4zQzkuMyA1OS4yIDI2LjcgNjQuNCAzNiA1Ny42IDQ1LjQgNTAuNyA0MS44IDM2LjggMTYuOCAzOC44em02My44LTEuMWMtMTEuMy0xLjktMTUuNSA0LjEtMTUgMTEuNCAzLjcgNi45IDIyLjEgNi4xIDMwLjUtMS4xIDguNC03LjItNC42LTE0LjctMTUuNS0xMC4zeiIvPjxwYXRoIGZpbGw9IiMyNzI4MjIiIGQ9Ik0zMC45IDcyLjljMCAuNy0uNSAxLjItMS4yIDEuMnMtMS4yLS41LTEuMi0xLjjjyAwLTEuMi41LTEuMiAxLjIuNSAxLjIgMS4yem0tNS42LTQuMmMwIC43LS41IDEuMi0xLjIgMS4ycy0xLjItLjUtMS4yLTEuMiAwLTEuMi41LTEuMiAxLjIgLjUgMS4yIDEuMnptNDIuMyAxLjdjMCAuNy0uNSAxLjItMS4yIDEuMnMtMS4yLS41LTEuMi0xLjcgMC0xLjIuNS0xLjIgMS4yLjUgMS4yIDEuMnptNS41LTMuOWMwIC43LS41IDEuMi0xLjIgMS4ycy0xLjItLjUtMS4yLTEuMiAwLTEuMi41LTEuMiAxLjIgLjUgMS4yIDEuMnoiLz48cGF0aCBkPSJNNjcuMyA1Ni4zYzEuMS0xLjYgMi43LTIuMyA0LjUtMi4zIDIuMSAwIDQuMS45IDUuNSAyLjggMS45IDIuNSAxLjkgNi44IDAgOS4zLTEuNCAxLjktMy40IDIuOC01LjUgMi44LTEuOCAwLTMuNC0uNy00LjUtMi4yLTEuNi0yLjQtMS42LTYuOCAwLTkuNHptLTM3LjYgMS43YzEuNC0xLjkgMy40LTIuOCA1LjUtMi44IDEuOCAwIDMuNC43IDQuNSAyLjIgMS42IDIuNSAxLjYgNi44IDAgOS40LTEuMSAxLjYtMi43IDIuMy00LjUgMi4zLTIuMSAwLTQuMS0uOS01LjUtMi44LTEuOS0yLjUtMS45LTYuOCAwLTkuM3oiIGZpbGw9IiNGRkZGRkYiLz48cGF0aCBmaWxsPSIjMjcyODIyIiBkPSJNNjUgNTcuNmMuOC0xLjIgMi0xLjggMy4zLTEuOCAxLjUgMCAyLjkuNyAzLjkgMiAxLjMgMS43IDEuMyA0LjggMCA2LjUtMSAxLjMtMi40IDItMy45IDItMS4zIDAtMi41LS42LTMuMy0xLjgtMS4xLTEuNy0xLjEtNC43IDAtNi45em0tMzcuNyAxLjNjMS0xLjMgMi40LTIgMy45LTJzMi45LjcgMy45IDIgMS4zIDQuOCAwIDYuNWMtMSAxLjMtMi40IDItMy45IDItMS41IDAtMi45LS43LTMuOS0yLTEuMy0xLjctMS4zLTQuOCAwLTYuNXoiLz48cGF0aCBmaWxsPSIjMjcyODIyIiBkPSJNNTQuMSA4MS4xYy0xLjIgMC0yLjQuOC0yLjQgMS45IDAgMS42IDEuNiAyLjIgMy41IDIuMiAxLjkgMCAzLjUtLjYgMy41LTIuMiAwLTEuMS0xLjItMS45LTIuNC0xLjktMi4yIDAtMi4yIDAgMi4yIDBjMS4yIDAgMi40LS44IDIuNC0xLjkgMC0xLjYtMS42LTIuMi0zLjUtMi4yLTEuOSAwLTMuNS42LTMuNSA3LjIgMCAxLjEuMSAxLjktMi40IDEuOXMtMi40LS44LTIuNC0xLjljMC0xLjYtMS42LTIuMi0zLjUtMi4yLTEuOSAwLTMuNS42LTMuNSA1LjIgMCAxLjEuMSAxLjktMi40IDEuOXMtMi40LS44LTIuNC0xLjljMC0xLjYtMS42LTIuMi0zLjUtMi4yLTEuOSAwLTMuNS42LTMuNSAyLjIgMCAxLjEuMSAxLjktMi40IDEuOXMtMi40LS44LTIuNC0xLjljMC00LjQtNi40LTUuMi03LjgtMy4zLTEuMyAxLjcgMS40IDQuMyA1LjUgNC4zaDIxLjJjNC4xIDAgNi44LTIuNiA1LjUtNC4zLTEuMy0xLjgtNi4xLTIuNS03LjgtMy40LTEuMi0uNi0yLjMtMS40LTIuMy0yLjggMC0xLjYgMS42LTIuMiAzLjUtMi4yIDEuOSAwIDMuNS42IDMuNSAyLjIgMCAxLjEuMSAxLjktMi40IDEuOXMtMi40LS44LTIuNC0xLjljMC0xLjYtMS42LTIuMi0zLjUtMi4yLTEuOSAwLTMuNS42LTMuNSAyLjIgMCAuNy4zIDEuMy43IDEuN3oiLz48L3N2Zz4=', names: ['Dog', 'Puppy'] },
        { id: 'img-2c', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjOEQ1RTQwIiBkPSJNNTQuNiAyMi40QzQ1LjQgMTQuMSAzMi41IDE1LjYgMjIgMjMuOGMtOS4xIDcuMi03LjkgMjQuNSAxLjMgMzEuOCAxMy4zIDEwLjYgMzQuMiAyLjkgMzQuMi0xNC40IDAtMTEuOC04LjUtMTguOS04LjktMTguOHptLTEwLjkgNTMuN2MtMTUuOCAxLjktMzEuMy0xMS4yLTMzLjItMjctMS45LTE1L.ggOS45LTMwLjIgMjUuNy0zMi4xIDE1LjgtMS45IDMxLjMgMTEuMiAzMy4yIDI3IDEuOSA4LjgtLjcgMTcuNS02LjEgMjMuNSIvPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik03Ni45IDMyLjdjOS44IDkuMyAxMC4yIDI1LTIuMiAzMi43LTEyLjUgNy43LTI5LjEtMi0zMi43LTE2LjItMy42LTE0LjIgNC41LTI2LjggMTcuNS0yOS4zIDkuMi0xLjggMTguMS4yIDI0LjMgNS41IDMuMSAyLjYgMy4yIDcuMy0xLjggNy4zeiIvPjxwYXRoIGZpbGw9IiMyNzI4MjIiIGQ9Ik0zNy44IDYxLjljMCAuOS0uNyAxLjctMS43IDEuNy0uOSAwLTEuNy0uNy0xLjctMS43IDAtLjkuNy0xLjcgMS43LTEuNy45IDAgMS43LjcgMS43IDEuN3ptMjQuOC0xNmMwIC45LS43IDEuNy0xLjcgMS43LS45IDAtMS43LS43LTEuNy0xLjcgMC0uOS43LTEuNyAxLjctMS43Ljl1IDAgMS43LjcgMS43IDEuN3oiLz48cGF0aCBkPSJNNTQuNiA2NC4zYy0uOSAwLTEuOC0uMi0yLjYtLjYtMS45LTEtMy0zLjEtMi42LTUuM2wxLjMtNy43YzEuOC0xMS4zIDEyLjEtMTQuOCAxOS4zLTkuNSAyLjQgMS44IDMuNyA0LjYgMy42IDcuNmwtLjQgOC4zYy0uMiAyLjgtMS42IDUuMi0zLjkgNi42LTQuNCAyLjctMTAuOC4yLTEzLjYtNC42bC0xLjItMS44IiBmaWxsPSIjMjcyODIyIi8+PC9zdmc+', names: ['Bear'] },
        { id: 'img-2d', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjRThFQUVBIiBkPSJNNzIgMzcuN2MtMTEuMy0xMi44LTMxLjUtOC42LTM5LjktLjgtNC4yIDMuOS01LjQgOS43LTMuMiAxNC45IDQuNCAxMCAxMy45IDE2LjUgMjQuNSAxNi41IDEyLjggMCAyMi0xMC41IDIyLjUtMjMuMWwtMy45LTcuNXptLTYyLjEgMTEuN0MxLjYgMzguMSAxMy45IDIwLjEgMzMuMyAxMS43YzE5LjMtOC40IDQyLjkgMi4xIDUwLjYgMjIuOScyLjYgNDQuOS0xOC4xIDUyLjZTMTEuMyA2NS45IDkuOSA0OS40eiIvPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik0zMy4xIDA0LjZjLTIuOSAxMS43IDYuOCAyMy4xIDE4LjUgMjZsOSA5LjggNy41IDE3LjYgMjEuMy00LjJDNzEuMyAyMy40IDUwLjggMTEuMSAzMy4xIDI0LjZ6Ii8+PHBhdGggZmlsbD0iI0ZGM0E5QSIgZD0iTTQ5LjUgNjFjLTIuMS0uOS0yLjItMy45LS4xLTYgMS4xLTEuMSAyLjgtMS41IDQuMy0xLjEgMS41LjQgMi42IDEuNiAyLjggMy4xIDEuNCAxMS4zIDkuNCAxMS42IDkuNCAxMS42Ii8+PHBhdGggZmlsbD0iIzI3MjgyMiIgZD0iTTQyLjMgNDYuN2MwIC45LS43IDEuNy0xLjcgMS43cy0xLjctLjctMS43LTEuNyAwLS45LjctMS43IDEuNy0uNyAxLjctMS43em0xNS41IDBjMCAuOS0uNyAxLjctMS43IDEuN3MtMS43LS43LTEuNy0xLjcgMC0uOS43LTEuNyAxLjctLjcgMS43LTEuN3oiLz48cGF0aAgb3BhY2l0eT0iLjciIGZpbGw9IiNGRjNBOWEiIGQ9Ik01My43IDU1LjljLTEuMi0xLjEtMy0xLjUtNC42LTEuMS0xLjYuNC0yLjcgMS43LTIuOSAzLjEtLjEgMS4xLjIgMi4yLjggMy4xLjcgbTEuNi03LjRjLTQuMyAxLjEtOC44IDUuMi05LjcgOS45Ii8+PHBhdGggZmlsbD0iI0ZGM0E5QSIgZD0iTTQ3LjMgNTUuOWMtMy4xIDEuNS02LjggNS40LTYuOCA1LjQiLz48L3N2Zz4=', names: ['Bunny', 'Rabbit'] },
      ],
    },
     {
      id: 'collection-3',
      name: 'Colorful Animals',
      complexity: 2,
      images: [
        { id: 'img-3a', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjRkZBNjAwIiBkPSJNMzIgMjEuNmMxLjQtMTMuNiAxOC4xLTE2LjEgMjUuOS0xMy40IDIuOSAxIDYuMiAxLjMgOC40IDIuNyAxNC4yIDkuMiAxMS40IDM0LjMtNi41IDM4LTIwLjkgNC4yLTI2LjYtMTMtMjcuOC0yNy4zeiIvPjxwYXRoIGZpbGw9IiNGRkQ3MDAiIGQ9Ik00MC4xIDM4LjdjLTE1LjYgMy45LTE4LjIgMjYuOS00LjggMzYgMTEuMyA3LjcgMjguOSAyLjEgMzQuMy05LjJzMi0zMS4yLTE1LjUtMzUuMWMtNi40LTEuNS0xMy4zLS4xLTE0IDguMyIvPjxwYXRoIGZpbGw9IiMyNzI4MjIiIGQ9Ik00NyA1MWMwIC45LS43IDEuNy0xLjcgMS43cy0xLjctLjctMS43LTEuNyAwLS45LjctMS43IDEuNy0uNyAxLjctMS43em0xMCAwYzAgLjktLjcgMS43LTEuNyAxLjdzLTEuNy0uNy0xLjctMS43IDAtLjkuNy0xLjcgMS43LS4jIDEuNy0xLjd6Ii8+PHBhdGggZmlsbD0iI0ZGQzEwNyIgZD0iTTMzLjggNzQuN2MtOS43IDEwLjEtNC40IDI0LjkgMTEuNyAyMy43IDE2LjItMS4yIDE3LjUtMTguOSAxNy41LTE4LjlsLTIuMS0yLjVjLTEuOS0yLjMtNS40LTIuMy03LjMgMGwtMS44IDEuOC0xLjggMS44LTEuOCAxLjhzLTMuOCAzLjgtNyA1Ii8+PHBhdGggZmlsbD0iI0M1NTMwMCIgZD0iTTUxLjMgNTkuNmMtMS40IDAtMi44LS41LTMuOC0xLjYtMS42LTEuNy0xLjYtNC41IDAtNi4yIDEuMS0xIDEuMy0yLjggMS4xLTQuNC0uMy0xLjUtMS4zLTIuOC0yLjYtMy40LTEuNy0uOC0zLjYtLjQtNSAxIC42LTEuNy4yLTMuNi0xLjEtNC45LTEuMy0xLjQtMy4xLTEuOS00LjktMS41LTQuMSAxLTUuNiA1LjUtMy42IDguOSAyLjIgMy45IDcuMyA0LjkgMTEuMSA0LjcgMS4xLS4xIDIuMi0uNCAzLjItLjggMS45LjcgMy4xIDEuOSA0IDMuNi45IDEuNyAxIDEuMy0uNSA0LjciLz48L3N2Zz4=', names: ['Lion'] },
        { id: 'img-3b', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjOENDQzY0IiBkPSJNNTQuMiA3Mi42QzQwLjUgNzUuOCAyNiA3MC4xIDE5LjYgNTguMUMxMy4yIDQ2LjIgMTMuNSA0My42IDMwLjEgMjEuNCA0My4yIDMuMyA2My45IDEuOCA3Ny42IDEwLjggOTQuOSAyMS44IDg4LjUgNTMuMyA2OS44IDY0LjUgNjQuMyA2Ny45IDU5LjUgNzEuMiA1NC4yIDcyLjZ6Ii8+PHBhdGggZmlsbD0iI0ZGRkZGRiIgZD0iTTI3LjkgMzEuNGMtNy45IDYuNS05LjIgMjAuNS0zIDI5LjRzMTguNSA5LjYgMjYuMyAzLjEgOS4yLTIwLjUgMy0yOS40LTIwLjYtOS42LTI2LjMtMy4xem0zNS45LjkjLTcuOSA2LjUtOS4yIDIwLjUtMyAyOS40IDE2LjIgOS4xIDE4LjUgOS42IDI2LjMgMy4xIDkuMi0yMC41IDMtMjkuNC0xMC4zLTMuMXoiLz48cGF0aCBmaWxsPSIjMjcyODIyIiBkPSJNMzQuMiAzOC40Yy00LjYgMC04LjQgMy44LTguNCA4LjQgMCA0LjYgMy44IDguNCA4LjQgOC40IDQuNiAwIDguNC0zLjggOC40LTguNCAwLTQuNi0zLjgtOC40LTguNC04LjR6bTIzLjQgMGMtNC42IDAtOC40IDMuOC04LjQgOC40IDAgNC42IDMuOCA4LjQgOC40IDguNCA0LjYgMCA4LjQtMy44IDguNC04LjQgMC00LjYtMy44LTguNC04LjQtOC40eiIvPjxwYXRoIGZpbGw9IiNDNjAwMDAiIGQ9Ik01Ny4yIDYwLjljLTIuNy0xLjktNS45LTEuOS04LjYgMC0xLjQuOS0zLjEgMS45LTMuMSAzLjEgMCAyLjUgMy4zIDQuNiA3LjQgNC42czcuNC0yLjEgNy40LTQuNmMwLTEuMy0xLjYtMi4xLTMuMS0zLjF6Ii8+PC9zdmc+', names: ['Frog'] },
        { id: 'img-3c', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjRkZENzAwIiBkPSJNNzIgNDIuM2MtMTAuOS0zLjQtMjMuNS0uOS0zMS4yIDcuMy03LjcgOC4yLTkuNiAyMC4xLTQuMyAyOS42IDUuMyA5LjYgMTUuOSAxNC45IDI3LjMgMTQuOSAxMy42IDAgMjUuNS03LjEgMzEtMTkuMyA0LjUtOS42IDQuNS0yMi45IDAtMzAuNmwtMjIuOC0xLjl6Ii8+PHBhdGggZmlsbD0iI0ZGQzEwNyIgZD0iTTU3LjIgNDQuOGMtMTEuMy42LTE5LjcgOS40LTE5LjcgMjAuNiAwIDEwLjEgNy41IDE4LjUgMTcuNSAxOS43IDEwLjEgMS4yIDE5LjQtNS44IDIxLjktMTUuNCAyLjItOS4xLTIuNy0xOC4zLTExLjktMjIuOS0yLjItMS4xLTQuOS0xLjktNy44LTIiLz48cGF0aCBmaWxsPSIjRkZGRkZGIiBkPSJNNDEuMyA1OC44Yy0yLjQgMC00LjMgMS45LTQuMyA0LjNzMS45IDQuMyA0LjMgNC4zIDQuMy0xLjkgNC4zLTQuMy0xLjktNC4zLTQuMy00LjN6bTIzLjEgMGMtMi40IDAtNC4zIDEuOS00LjMgNC4zczEuOSA0LjMgNC4zIDQuMyA0LjMtMS45IDQuMy00LjMtMS45LTQuMy00LjMtNC4zeiIvPjxwYXRoIGZpbGw9IiNGRkE2MDAiIGQ9Ik0zMS4yIDU2LjhjLTUuNi0xLjEtMTAuNyAxLjgtMTIuNiA3LjEgLTEuOSA1LjMgLjIgMTEuMSA1LjggMTIuMiA1LjYgMS4xIDEwLjctMS44IDEyLjYtNy4xIDEuOS01LjMtLjItMTEuMS01LjgtMTIuMnptNDcuNCAxLjljLTUuNi0xLjEtMTAuNyAxLjgtMTIuNiA3LjEtMS45IDUuMy4yIDExLjEgNS44IDEyLjIgNS42IDEuMSAxMC43LTEuOCAxMi42LTcuMSAxLjgtNS4zLS4yLTExLjEtNS44LTEyLjJ6Ii8+PC9zdmc+', names: ['Duck'] },
        { id: 'img-3d', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjRkZDRURFUSIgZD0iTTE2LjQgMzguNGMxLjEtMTUgMTQuNC0yNi4zIDI5LjQtMjUuMiAxMy40IDEgMjQuNiAxMS4zIDI1LjcgMjQuNyAxLjQgMTYuMi0xMC4yIDMwLjQtMjUuNyAzMC40LTE1LjYtLjEtMjcuMi0xNC40LTI1LjQtMzAuMnptNjguMy00LjJDNzEuMSAxMC4xIDQzLjMgMTEuNyAyOS4zIDI1LjEgMTIuMyAzNS42IDExIDYwLjYgMjMgNzQuOWMxMiAxNC4yIDM0LjEgMTQuMiA0Ni4xIDAgMTItMTQuMyAxMS4yLTM4LjQtMS41LTQwLjN6Ii8+PHBhdGggZmlsbD0iI0ZGMTA4QSIgZD0iTTU0LjIgNDQuOWMtNC43IDAtOC41IDQuMy04LjUgOS41czMuOCA5LjUgOC41IDkuNSA4LjUtNC4zIDguNS05LjUtMy44LTkuNS04LjUtOS41em0yNC41LTguOGMtNy40LTIuOS0xMy4zIDIuNC0xMy4zIDEwLjIgMCA1LjggNC40IDEwLjYgMTAuMSAxMi4xIDUuNyAxLjUgMTEuOS0yLjEgMTMuMy04LjhzLTIuNC0xMi4xLTcuMi0xMy4yIDAgMCAtMi45LS4zem0tNDkuMy4zYy03LjQgMi45LTEwLjMgMTEtNS4xIDE2LjhzMTQuMyA0LjUgMTguOC0yLjkgNS4xLTE2LjgtNS4xLTE2LjhjLTIuOS0xLjctOC41LTIuOS04LjYtMi45eiIvPjxwYXRoIGZpbGw9IiMyNzI4MjIiIGQ9Ik0zNy44IDU1LjljMCAxLjItLjkgMi4xLTIuMSAyLjFzLTIuMS0uOS0yLjEtMi4xIDAtMS4yLjktMi4xIDIuMS0uOSAyLjEuOXptMjcuMy0yLjFjMCAxLjItLjkgMi4xLTIuMSAyLjFzLTIuMS0uOS0yLjEtMi4xIDAtMS4yLjktMi4xIDIuMS0uOSAyLjEuOXoiLz48cGF0aCBmaWxsPSIjRkY4QUE4IiBkPSJNNTQuMiA1NC43Yy0yLjYgMC00LjcgMi40LTQuNyA1LjNzMi4xIDUuMyA0LjcgNS4zIDQuNy0yLjQgNC43LTUuMy0yLjEtNS4zLTQuNy01LjN6Ii8+PHBhdGggZmlsbD0iIzI3MjgyMiIgZD0iTTUyLjYgNTYuOWMwIC42LS41IDEuMS0xLjEgMS4xcy0xLjEtLjUtMS4xLTEuMSAwLS42LjUtMS4xIDEuMS0uNSAxLjEuNXptNS4yLS4yYzAgLjYtLjUgMS4xLTEuMSAxLjFzLTEuMS0uNS0xLjEtMS4xIDAtLjYuNS0xLjEgMS4xLS41IDEuMS41eiIvPjwvc3ZnPg==', names: ['Pig'] },
      ],
    },
    {
      id: 'collection-4',
      name: 'Family Faces',
      complexity: 3,
      images: [
        { id: 'img-4a', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjRkZDRURBIiBkPSJNNzcuNCA0My4yYzMuMy0xMS42LTUuMy0yMy40LTE3LTI2LjctMTEuNi0zLjQtMjQuMiA0LjQtMjYuNyAxN0M MjEuMyA0Mi44IDM2LjkgNTMuMyA0OC40IDUzLjNjMTEuNiAwIDIyLjEtNy45IDI5LTEwLjF6Ii8+PHBhdGggZmlsbD0iIzY2MzkxRSIgZD0iTTU1LjEgMTljLTEzLjMgNC0yMC4xIDE4LjktMTUuMSAzMi44IDQuMyAxMS45IDE2LjYgMTkuMiAyOC41IDE0LjkgMTIuOC00LjYgMTkuMi0xOC44IDE0LjktMzIuOC00LTExLjYtMTQtMTguOC0yMy4zLTE0LjloLTQuMXoiLz48cGF0aCBmaWxsPSIjMjcyODIyIiBkPSJNNjIgMzcuNGMwIDEuMi0xIDIuMS0yLjEgMi4xL TEuMiAwLTIuMS0xLTIuMS0yLjEgMC0xLjIgMS0yLjEgMi4xLTIuMSAxLjIgMCAyLjEgMSAyLjEgMi4xem0tMjAuMyAyLjFjMCAxLjItMSAyLjEtMi4xIDIuMS0xLjIgMC0yLjEtMS0yLjEtMi4xIDAtMS4yIDEtMi4xIDIuMS0yLjEgMS4yIDAgMi4xIDEgMi4xIDIuMXoiLz48cGF0aCBmaWxsPSIjRkY4QUE4IiBkPSJNNTcuNiA0OS4yYy01LjUgMC0xMCA0LjItMTAgOS4zIDAgMy4yIDEuOCA2IDIuOSA3LjYgMS44IDIuNiA0LjggNC4zIDcuMSA0LjNzNS4zLTEuNyA3LjEtNC4zYzEuMS0xLjYgMi45LTQuNCAyLjktNy42IDAtNS4xLTQuNS05LjItMTAtOS4yIi8+PC9zdmc+', names: ['Mama', 'Mom'] },
        { id: 'img-4b', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjRkZDRURBIiBkPSJNNzcuNCA0My4yYzMuMy0xMS42LTUuMy0yMy40LTE3LTI2LjctMTEuNi0zLjQtMjQuMiA0LjQtMjYuNyAxN0M MjEuMyA0Mi44IDM2LjkgNTMuMyA0OC40IDUzLjNjMTEuNiAwIDIyLjEtNy45IDI5LTEwLjF6Ii8+PHBhdGggZmlsbD0iIzE1NDk5QiIgZD0iTTU3LjMgMjIuM2MtMTEuMy0xLjEtMjEuOSAxLjctMjggOC43LTcuOCA4LjEtOC44IDIyLjEtMi4xIDMxLjggNi43IDkuNyAxOS4yIDEzLjQgMzAuNSAxMi4zIDEyLjktMS4zIDIyLjEtMTEuNSAyMC44LTI0LjRzLTExLjUtMjIuMS0yMS4yLTI4LjR6Ii8+PHBhdGggZmlsbD0iIzI3MjgyMiIgZD0iTTM5LjYgNDAuNGMwIDEuMi0xIDIuMS0yLjEgMi4xcy0yLjEtLjktMi4xLTIuMSAwLTEuMiAxLTIuMSAyLjEtLjkgMi4xLjl6bTIyLjktMi4xYzAgMS4yLTEgMi4xLTIuMSAyLjFzLTIuMS0uOS0yLjEtMi4xIDAtMS4yIDEuMi0yLjEgMi4xLS45IDIuMS45eiIvPjxwYXRoIGZpbGw9IiNGRjdDMDAiIGQ9Ik00Ny45IDQ4Yy0uNy0uOS0xLjktMS40LTMtMS40cy0yLjMuNS0zIDEuNGMtMS44IDIuMy01LjMgMy04LjIgMi4xLTEwLjUtMy4yLTEyLjIgMTEuMy0yLjggMTUuMyA1LjggMi41IDEzLjggMCAxNi43LTYuNy44LTEuOCAxLjUtMy42IDEuNC01LjYgMC0zLjEtMi45LTUuNy02LjMtNS43aC0xLjciLz48L3N2Zz4=', names: ['Papa', 'Dad'] },
      ]
    },
  ], []);

  const [collections, setCollections] = useState<ImageCollection[]>(() => {
    try {
      const savedCollections = localStorage.getItem('cogniplay-collections');
      return savedCollections ? JSON.parse(savedCollections) : mockCollections;
    } catch (e) {
      console.error("Could not read collections from localStorage", e);
      return mockCollections;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cogniplay-collections', JSON.stringify(collections));
    } catch (e) {
      console.error("Could not save collections to localStorage", e);
    }
  }, [collections]);

  useEffect(() => {
    const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        const englishVoices = allVoices.filter(voice => voice.lang.startsWith('en-'));
        setAvailableVoices(englishVoices);

        if (!localStorage.getItem('cogniplay-voice') && englishVoices.length > 0) {
            let defaultVoice: SpeechSynthesisVoice | undefined;
            const preferredVoices = [
                (v: SpeechSynthesisVoice) => v.name === 'Google UK English Female',
                (v: SpeechSynthesisVoice) => v.name === 'Samantha',
                (v: SpeechSynthesisVoice) => v.lang === 'en-US' && v.name.includes('Google'),
                (v: SpeechSynthesisVoice) => v.lang.startsWith('en-') && v.localService,
            ];

             for (const condition of preferredVoices) {
                const foundVoice = englishVoices.find(condition);
                if (foundVoice) {
                    defaultVoice = foundVoice;
                    break;
                }
            }
            if (!defaultVoice) {
                defaultVoice = englishVoices[0];
            }
            
            if (defaultVoice) {
                const voiceName = defaultVoice.name;
                setSelectedVoiceName(voiceName);
                localStorage.setItem('cogniplay-voice', voiceName);
            }
        }
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    try {
        localStorage.setItem('cogniplay-voice', voiceName);
    } catch (e) {
        console.error("Could not save voice to localStorage", e);
    }
  };

  const handleStartGame = (collection: ImageCollection) => {
    setSelectedCollection(collection);
    setGameStatus(GameStatus.LOADING);
  };

  const handleEndGame = () => {
    setGameStatus(GameStatus.IDLE);
    setSelectedCollection(null);
  };

  const handleSaveCollection = (collectionData: Omit<ImageCollection, 'id'> & { id?: string }) => {
    if (collectionData.id) {
      setCollections(collections.map(c => c.id === collectionData.id ? { ...c, ...collectionData } as ImageCollection : c));
    } else {
      const newCollection = { ...collectionData, id: `collection-${Date.now()}` } as ImageCollection;
      setCollections([...collections, newCollection]);
    }
    setIsFormOpen(false);
  };

  const handleDeleteCollection = (id: string) => {
    if (window.confirm("Are you sure you want to delete this collection?")) {
        setCollections(collections.filter(c => c.id !== id));
    }
  };

  const handleEditCollection = (collection: ImageCollection | null) => {
    setEditingCollection(collection);
    setIsFormOpen(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-800 tracking-tight">
            Cogni<span className="text-blue-500">Play</span> AI
        </h1>
        <p className="mt-2 text-lg text-gray-500">A fun learning adventure for your little one</p>
      </header>
      <main>
        {gameStatus === GameStatus.IDLE || gameStatus === GameStatus.FINISHED ? (
          <ParentDashboard
            collections={collections}
            onStartGame={handleStartGame}
            onNewCollection={() => handleEditCollection(null)}
            onEditCollection={handleEditCollection}
            onDeleteCollection={handleDeleteCollection}
            availableVoices={availableVoices}
            selectedVoiceName={selectedVoiceName}
            onVoiceChange={handleVoiceChange}
          />
        ) : (
          <GameScreen
            collection={selectedCollection!}
            onEndGame={handleEndGame}
            gameStatus={gameStatus}
            setGameStatus={setGameStatus}
            selectedVoiceName={selectedVoiceName}
          />
        )}
        {isFormOpen && (
          <CollectionForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSaveCollection}
            collection={editingCollection}
          />
        )}
      </main>
    </div>
  );
};

export default App;
