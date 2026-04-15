'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Heart, MessageCircle, Music, Upload, Trash2, Edit2, LogIn, LogOut,
  BarChart3, Clock, Disc3, User, Send, X, Headphones, ListMusic,
  Home as HomeIcon, Plus, Music2, Eye, Loader2, ChevronDown, ChevronUp,
  Search, Shuffle, Repeat, Repeat1, ListOrdered, ArrowUpDown,
  Sun, Moon
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ==================
// Helper Functions
// ==================
function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function Home() {
  // ==================
  // State
  // ==================
  const [view, setView] = useState('home');
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Player state
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Queue state
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');
  const [showQueue, setShowQueue] = useState(false);

  // Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');

  // Comments state
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Likes
  const [likedSongs, setLikedSongs] = useState({});

  // Admin state
  const [adminToken, setAdminToken] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingSongId, setEditingSongId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEdits, setBulkEdits] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [allComments, setAllComments] = useState([]);
  const [songFiles, setSongFiles] = useState([]);
  const [mounted, setMounted] = useState(false);

  const audioRef = useRef(null);
  const playCountedRef = useRef({});

  const { theme, setTheme, resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';

  // ==================
  // Filtered & Sorted Songs
  // ==================
  const filteredSongs = useMemo(() => {
    let result = [...songs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => s.title.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'plays':
        result.sort((a, b) => (b.plays || 0) - (a.plays || 0));
        break;
      case 'likes':
        result.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return result;
  }, [songs, searchQuery, sortBy]);

  // ==================
  // Audio Core
  // ==================
  const playSongDirect = useCallback((song) => {
    const audio = audioRef.current;
    if (!audio || !song) return;
    audio.src = `/songs/${song.filename}`;
    audio.load();
    audio.play().then(() => {
      setIsPlaying(true);
      setCurrentSong(song);
      setCurrentTime(0);
      setDuration(0);
      if (!playCountedRef.current[song.id]) {
        playCountedRef.current[song.id] = true;
        fetch('/api/plays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId: song.id }),
        }).then(() => {
          setSongs(prev => prev.map(s =>
            s.id === song.id ? { ...s, plays: (s.plays || 0) + 1 } : s
          ));
        }).catch(console.error);
      }
    }).catch(console.error);
  }, []);

  // Audio init
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.volume = 0.8;
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('error', () => setIsPlaying(false));
    return () => { audio.pause(); };
  }, []);

  // Ended handler (depends on queue state)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
        return;
      }
      if (queueIndex < queue.length - 1) {
        const nextSong = queue[queueIndex + 1];
        setQueueIndex(prev => prev + 1);
        playSongDirect(nextSong);
      } else if (repeatMode === 'all' && queue.length > 0) {
        setQueueIndex(0);
        playSongDirect(queue[0]);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [queue, queueIndex, repeatMode, playSongDirect]);

  // ==================
  // Queue Management
  // ==================
  function handlePlaySong(song) {
    const visibleSongs = filteredSongs;
    let newQueue;
    let newIndex;

    if (shuffleMode) {
      const others = visibleSongs.filter(s => s.id !== song.id);
      newQueue = [song, ...shuffleArray(others)];
      newIndex = 0;
    } else {
      newQueue = [...visibleSongs];
      newIndex = newQueue.findIndex(s => s.id === song.id);
      if (newIndex < 0) newIndex = 0;
    }

    setQueue(newQueue);
    setQueueIndex(newIndex);
    playSongDirect(song);
  }

  function toggleShuffle() {
    if (!currentSong || queue.length === 0) {
      setShuffleMode(!shuffleMode);
      toast.info(shuffleMode ? 'Shuffle off' : 'Shuffle on');
      return;
    }
    if (shuffleMode) {
      // Turn off: restore sorted order
      const sorted = [...filteredSongs];
      const newIdx = sorted.findIndex(s => s.id === currentSong.id);
      setQueue(sorted);
      setQueueIndex(newIdx >= 0 ? newIdx : 0);
    } else {
      // Turn on: shuffle remaining
      const remaining = queue.filter((_, i) => i !== queueIndex);
      const shuffled = shuffleArray(remaining);
      setQueue([currentSong, ...shuffled]);
      setQueueIndex(0);
    }
    setShuffleMode(!shuffleMode);
    toast.info(shuffleMode ? 'Shuffle off' : 'Shuffle on');
  }

  function cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const current = modes.indexOf(repeatMode);
    const next = modes[(current + 1) % modes.length];
    setRepeatMode(next);
    const labels = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
    toast.info(labels[next]);
  }

  function playFromQueue(idx) {
    if (idx < 0 || idx >= queue.length) return;
    setQueueIndex(idx);
    playSongDirect(queue[idx]);
  }

  function removeFromQueue(idx) {
    if (idx === queueIndex) return;
    const newQueue = queue.filter((_, i) => i !== idx);
    let newIndex = queueIndex;
    if (idx < queueIndex) newIndex--;
    setQueue(newQueue);
    setQueueIndex(newIndex);
  }

  // ==================
  // Player Controls
  // ==================
  function togglePlay() {
    if (!audioRef.current || !currentSong) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }

  function handleSeek(value) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  }

  function handleVolume(value) {
    if (!audioRef.current) return;
    const vol = value / 100;
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  }

  function toggleMute() {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume > 0 ? volume : 0.8;
      setIsMuted(false);
      if (volume === 0) setVolume(0.8);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }

  function playPrev() {
    if (!currentSong || queue.length === 0) return;
    if (currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (queueIndex > 0) {
      playFromQueue(queueIndex - 1);
    } else if (repeatMode === 'all') {
      playFromQueue(queue.length - 1);
    }
  }

  function playNext() {
    if (!currentSong || queue.length === 0) return;
    if (queueIndex < queue.length - 1) {
      playFromQueue(queueIndex + 1);
    } else if (repeatMode === 'all') {
      playFromQueue(0);
    }
  }

  // ==================
  // Data Fetching
  // ==================
  const fetchSongs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/songs');
      const data = await res.json();
      setSongs(data.songs || []);
    } catch (err) {
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSongFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/song-files');
      const data = await res.json();
      setSongFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load song files', err);
      setSongFiles([]);
    }
  }, []);

  const fetchComments = useCallback(async (songId) => {
    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/comments?songId=${songId}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const fetchAllComments = useCallback(async () => {
    try {
      const res = await fetch('/api/comments/all');
      const data = await res.json();
      setAllComments(data.comments || []);
    } catch (err) {
      console.error('Error fetching all comments:', err);
    }
  }, []);

  useEffect(() => { fetchSongs(); }, [fetchSongs]);
  useEffect(() => { fetchSongFiles(); }, [fetchSongFiles]);
  useEffect(() => {
    // Re-check duplicates when songs list changes
    if (uploadItems.length > 0) {
      setUploadItems(prev => checkDuplicates(prev));
    }
  }, [songs]);
  useEffect(() => { if (selectedSongId) fetchComments(selectedSongId); }, [selectedSongId, fetchComments]);
  useEffect(() => { try { const s = localStorage.getItem('likedSongs'); if (s) setLikedSongs(JSON.parse(s)); } catch (e) {} }, []);
  useEffect(() => { try { const s = localStorage.getItem('adminToken'); if (s) setAdminToken(s); } catch (e) {} }, []);

  // ==================
  // Like Handler
  // ==================
  async function handleLike(songId) {
    if (likedSongs[songId]) { toast.info('Already liked!'); return; }
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSongs(prev => prev.map(s => s.id === songId ? { ...s, likes: data.likes } : s));
        const newLiked = { ...likedSongs, [songId]: true };
        setLikedSongs(newLiked);
        localStorage.setItem('likedSongs', JSON.stringify(newLiked));
        toast.success('Song liked!');
      }
    } catch (err) { toast.error('Failed to like'); }
  }

  // ==================
  // Comment Handler
  // ==================
  async function handleSubmitComment(e) {
    e.preventDefault();
    if (!selectedSongId || !commentText.trim()) return;
    try {
      setCommentSubmitting(true);
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: selectedSongId, name: commentName.trim() || '', text: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText('');
        fetchComments(selectedSongId);
        toast.success('Comment posted!');
      }
    } catch (err) { toast.error('Failed to post comment'); }
    finally { setCommentSubmitting(false); }
  }

  // ==================
  // Admin Functions
  // ==================
  async function handleAdminLogin(e) {
    e.preventDefault();
    try {
      setLoginLoading(true);
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setView('admin');
        setLoginUsername('');
        setLoginPassword('');
        toast.success('Welcome, Admin!');
        fetchSongs();
      } else { toast.error(data.error || 'Invalid credentials'); }
    } catch (err) { toast.error('Login failed'); }
    finally { setLoginLoading(false); }
  }

  function handleLogout() {
    setAdminToken(null);
    localStorage.removeItem('adminToken');
    setView('home');
    toast.info('Logged out');
  }

  function checkDuplicates(items) {
    const existingTitles = new Set(songs.map(s => s.title.toLowerCase().trim()));
    const seenTitles = new Map();
    return items.map((item, idx) => {
      if (item.status === 'done') return item;
      const title = item.title.toLowerCase().trim();
      let duplicate = false;
      let duplicateReason = '';
      if (title && existingTitles.has(title)) {
        duplicate = true;
        duplicateReason = 'A song with this title already exists';
      } else if (title && seenTitles.has(title)) {
        duplicate = true;
        duplicateReason = `Duplicate of #${seenTitles.get(title) + 1} in this batch`;
        // Also mark the first occurrence if not already marked as existing
        const firstIdx = seenTitles.get(title);
        if (!items[firstIdx].duplicate) {
          items[firstIdx] = { ...items[firstIdx], duplicate: true, duplicateReason: 'Duplicate title in this batch' };
        }
      }
      if (title) seenTitles.set(title, idx);
      return { ...item, duplicate, duplicateReason };
    });
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 50) {
      toast.error('Maximum 50 files at a time');
      return;
    }
    const items = files.map(file => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim(),
      status: 'pending',
      duplicate: false,
      duplicateReason: '',
    }));
    setUploadItems(prev => {
      const combined = [...prev.filter(i => i.status !== 'done'), ...items];
      if (combined.length > 50) {
        toast.error('Maximum 50 files total');
        return checkDuplicates(combined.slice(0, 50));
      }
      return checkDuplicates(combined);
    });
    e.target.value = '';
  }

  function updateItemTitle(index, title) {
    setUploadItems(prev => {
      const updated = prev.map((item, i) => i === index ? { ...item, title } : item);
      return checkDuplicates(updated);
    });
  }

  function removeUploadItem(index) {
    setUploadItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleBulkUpload() {
    const pending = uploadItems.filter(i => (i.status === 'pending' || i.status === 'error') && !i.duplicate);
    const duplicates = uploadItems.filter(i => i.duplicate && i.status !== 'done');
    if (duplicates.length > 0) {
      toast.error(`${duplicates.length} song${duplicates.length > 1 ? 's have' : ' has'} duplicate title${duplicates.length > 1 ? 's' : ''} — fix or remove them first`);
      return;
    }
    if (pending.length === 0) { toast.error('No files to upload'); return; }
    const emptyTitles = pending.some(i => !i.title.trim());
    if (emptyTitles) { toast.error('All songs need a title'); return; }

    setBulkUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < uploadItems.length; i++) {
      const item = uploadItems[i];
      if (item.status === 'done') continue;

      setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'uploading' } : it));

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('title', item.title.trim());
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` },
          body: formData,
        });
        if (res.ok) {
          setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'done' } : it));
          successCount++;
        } else {
          const data = await res.json();
          setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: data.error } : it));
          failCount++;
        }
      } catch (err) {
        setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: 'Network error' } : it));
        failCount++;
      }
      setUploadProgress(prev => prev + 1);
    }

    setBulkUploading(false);
    fetchSongs();
    if (successCount > 0) toast.success(`${successCount} song${successCount > 1 ? 's' : ''} uploaded!`);
    if (failCount > 0) toast.error(`${failCount} upload${failCount > 1 ? 's' : ''} failed`);
    // Clear done items after short delay
    setTimeout(() => {
      setUploadItems(prev => prev.filter(i => i.status !== 'done'));
      setUploadProgress(0);
    }, 2000);
  }

  async function handleDeleteSong(songId) {
    if (!confirm('Delete this song?')) return;
    try {
      const res = await fetch(`/api/songs?id=${songId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      if (res.ok) {
        toast.success('Song deleted');
        if (currentSong?.id === songId) { audioRef.current?.pause(); setCurrentSong(null); setIsPlaying(false); setQueue([]); }
        fetchSongs();
      } else { toast.error('Failed to delete'); }
    } catch (err) { toast.error('Failed to delete'); }
  }

  async function handleEditSong(songId) {
    if (!editingTitle.trim()) return;
    try {
      const res = await fetch('/api/songs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ id: songId, title: editingTitle.trim() }),
      });
      if (res.ok) { toast.success('Song updated'); setEditingSongId(null); setEditingTitle(''); fetchSongs(); }
      else { toast.error('Failed to update'); }
    } catch (err) { toast.error('Failed to update'); }
  }

  function enterBulkEdit() {
    const edits = {};
    songs.forEach(s => { edits[s.id] = s.title; });
    setBulkEdits(edits);
    setBulkEditMode(true);
  }

  function exitBulkEdit() {
    setBulkEditMode(false);
    setBulkEdits({});
  }

  async function handleBulkSave() {
    const changed = songs.filter(s => bulkEdits[s.id] && bulkEdits[s.id].trim() !== s.title);
    if (changed.length === 0) { toast.info('No changes to save'); exitBulkEdit(); return; }

    setBulkSaving(true);
    let success = 0;
    let fail = 0;

    for (const song of changed) {
      try {
        const res = await fetch('/api/songs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ id: song.id, title: bulkEdits[song.id].trim() }),
        });
        if (res.ok) success++;
        else fail++;
      } catch (err) { fail++; }
    }

    setBulkSaving(false);
    exitBulkEdit();
    fetchSongs();
    if (success > 0) toast.success(`${success} title${success > 1 ? 's' : ''} updated!`);
    if (fail > 0) toast.error(`${fail} update${fail > 1 ? 's' : ''} failed`);
  }

  async function handleDeleteComment(commentId) {
    try {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      if (res.ok) { toast.success('Comment deleted'); if (selectedSongId) fetchComments(selectedSongId); if (view === 'admin') fetchAllComments(); }
    } catch (err) { toast.error('Failed to delete comment'); }
  }

  // ==================
  // Render Helpers
  // ==================
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  // ==================
  // RENDER
  // ==================
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          <button
            onClick={() => setView('home')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center">
              <Music2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight">ATTIKID</span>
            <Badge variant="secondary" className="text-xs hidden sm:inline-flex">Music</Badge>
          </button>

          <nav className="flex items-center gap-1 sm:gap-2">
            {mounted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-8 sm:h-9 w-8 sm:w-9 p-0"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            )}
            <Button
              variant={view === 'home' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('home')}
              className="h-8 sm:h-9 px-2 sm:px-3"
            >
              <HomeIcon className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            {adminToken ? (
              <>
                <Button
                  variant={view === 'admin' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => { setView('admin'); fetchAllComments(); }}
                  className="h-8 sm:h-9 px-2 sm:px-3"
                >
                  <BarChart3 className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 sm:h-9 px-2 sm:px-3">
                  <LogOut className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <Button
                variant={view === 'login' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('login')}
                className="h-8 sm:h-9 px-2 sm:px-3"
              >
                <LogIn className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className={`max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 ${
        currentSong ? 'pb-40 sm:pb-36' : 'pb-8'
      }`}>

        {/* --- HOME VIEW --- */}
        {view === 'home' && (
          <div>
            {/* Hero */}
            <div className="mb-6 sm:mb-10">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2 sm:mb-3">
                Stream. Feel. <span className="text-primary">Repeat.</span>
              </h1>
              <p className="text-muted-foreground text-sm sm:text-lg max-w-xl">
                Independent music, streamed for free. Like your favorites and leave a comment.
              </p>
            </div>

            {/* Search & Sort Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-card"
                />
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-10 bg-card text-foreground border border-border rounded-md px-3 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="date">Latest</option>
                  <option value="plays">Most Played</option>
                  <option value="likes">Most Liked</option>
                  <option value="title">A - Z</option>
                </select>
              </div>
            </div>

            {/* Songs Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
                <Disc3 className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mb-4" />
                <h2 className="text-xl sm:text-2xl font-semibold mb-2">
                  {searchQuery ? 'No songs found' : 'No songs yet'}
                </h2>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {searchQuery ? 'Try a different search term' : 'Check back soon for fresh tracks!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredSongs.map(song => {
                  const isActive = currentSong?.id === song.id;
                  const isLiked = likedSongs[song.id];
                  return (
                    <Card
                      key={song.id}
                      className={`group transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 ${
                        isActive ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : 'hover:border-primary/30'
                      }`}
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0 mr-3">
                            <h3 className={`font-semibold text-base sm:text-lg truncate ${
                              isActive ? 'text-primary' : 'text-foreground'
                            }`}>
                              {song.title}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                {song.plays || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                                {song.likes || 0}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            className={`rounded-full w-10 h-10 sm:w-12 sm:h-12 shrink-0 transition-all ${
                              isActive && isPlaying
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                                : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
                            }`}
                            onClick={() => {
                              if (isActive) togglePlay();
                              else handlePlaySong(song);
                            }}
                          >
                            {isActive && isPlaying ? (
                              <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                            ) : (
                              <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
                            )}
                          </Button>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 px-2 sm:px-3 ${
                              isLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleLike(song.id); }}
                          >
                            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiked ? 'fill-current' : ''}`} />
                            Like
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 px-2 sm:px-3 text-muted-foreground hover:text-primary ${
                              selectedSongId === song.id ? 'text-primary bg-primary/10' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSongId(selectedSongId === song.id ? null : song.id);
                            }}
                          >
                            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Comments
                            {selectedSongId === song.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>
                        </div>

                        {/* Inline Comments */}
                        {selectedSongId === song.id && (
                          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                            <form onSubmit={handleSubmitComment} className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                              <Input
                                placeholder="Your name (optional)"
                                value={commentName}
                                onChange={(e) => setCommentName(e.target.value)}
                                className="bg-background/50 h-8 sm:h-9 text-sm"
                              />
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Write a comment..."
                                  value={commentText}
                                  onChange={(e) => setCommentText(e.target.value)}
                                  className="bg-background/50 h-8 sm:h-9 text-sm"
                                  required
                                />
                                <Button type="submit" size="sm" disabled={commentSubmitting || !commentText.trim()} className="h-8 sm:h-9 px-3">
                                  {commentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                              </div>
                            </form>
                            {commentsLoading ? (
                              <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                            ) : comments.length === 0 ? (
                              <p className="text-xs sm:text-sm text-muted-foreground text-center py-3">No comments yet. Be the first!</p>
                            ) : (
                              <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-60 overflow-y-auto pr-1">
                                {comments.map(comment => (
                                  <div key={comment.id} className="bg-background/50 rounded-lg p-2.5 sm:p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                          <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                                        </div>
                                        <span className="text-xs sm:text-sm font-medium">{comment.name}</span>
                                      </div>
                                      <span className="text-[10px] sm:text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground pl-7 sm:pl-8">{comment.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
              {songFiles.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4">Local MP3 Files</h2>
                <div className="space-y-4">
                  {songFiles.map((file) => (
                    <div key={file} className="rounded-xl border border-border p-4 bg-background/80">
                      <p className="text-sm font-medium mb-2 truncate">{file}</p>
                      <audio controls className="w-full">
                        <source src={`/songs/${encodeURIComponent(file)}`} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- LOGIN VIEW --- */}
        {view === 'login' && (
          <div className="flex items-center justify-center min-h-[60vh] px-2">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <LogIn className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold">Admin Login</h2>
                  <p className="text-muted-foreground mt-1 text-sm">Access the dashboard</p>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Username</label>
                    <Input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Enter username" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Password</label>
                    <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Enter password" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                    Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- ADMIN VIEW --- */}
        {view === 'admin' && adminToken && (
          <div>
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">Admin Dashboard</h1>
              <p className="text-muted-foreground text-sm">Manage your music platform</p>
            </div>

            <Tabs defaultValue="upload" className="space-y-4 sm:space-y-6">
              <TabsList className="bg-secondary flex-wrap h-auto p-1">
                <TabsTrigger value="upload" className="gap-1.5 text-xs sm:text-sm">
                  <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Upload
                </TabsTrigger>
                <TabsTrigger value="songs" className="gap-1.5 text-xs sm:text-sm">
                  <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Songs
                </TabsTrigger>
                <TabsTrigger value="comments" className="gap-1.5 text-xs sm:text-sm" onClick={fetchAllComments}>
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Comments
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-1.5 text-xs sm:text-sm">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Analytics
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload">
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold">Upload Songs</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Select up to 50 audio files, edit titles, then upload</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer">
                          <Input
                            type="file"
                            accept=".mp3,.wav,.ogg,.m4a,audio/*"
                            multiple
                            onChange={handleFilesSelected}
                            className="hidden"
                            disabled={bulkUploading}
                          />
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            bulkUploading
                              ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer'
                          }`}>
                            <Plus className="w-4 h-4" />
                            Add Files
                          </div>
                        </label>
                        {uploadItems.length > 0 && (
                          <>
                            {uploadItems.some(i => i.duplicate) && (
                              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 text-xs">
                                {uploadItems.filter(i => i.duplicate).length} duplicate{uploadItems.filter(i => i.duplicate).length > 1 ? 's' : ''}
                              </Badge>
                            )}
                            <Button
                              onClick={handleBulkUpload}
                              disabled={bulkUploading || uploadItems.some(i => i.duplicate) || uploadItems.filter(i => i.status === 'pending' || i.status === 'error').length === 0}
                            >
                              {bulkUploading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  Uploading {uploadProgress}/{uploadItems.length}
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload {uploadItems.filter(i => (i.status === 'pending' || i.status === 'error') && !i.duplicate).length} Song{uploadItems.filter(i => (i.status === 'pending' || i.status === 'error') && !i.duplicate).length !== 1 ? 's' : ''}
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress bar during upload */}
                    {bulkUploading && (
                      <div className="mb-4">
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300 rounded-full"
                            style={{ width: `${uploadItems.length > 0 ? (uploadProgress / uploadItems.length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 sm:py-16 border-2 border-dashed border-border rounded-xl">
                        <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground text-sm sm:text-base mb-1">Click "Add Files" to select audio files</p>
                        <p className="text-xs text-muted-foreground">Supported: MP3, WAV, OGG, M4A · Max 50 files</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-1">
                          <span>{uploadItems.length} file{uploadItems.length !== 1 ? 's' : ''} selected</span>
                          {!bulkUploading && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => setUploadItems([])}
                            >
                              Clear all
                            </Button>
                          )}
                        </div>
                        <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                          {uploadItems.map((item, idx) => (
                            <div
                              key={`upload-${idx}`}
                              className={`flex items-center gap-2 sm:gap-3 p-3 rounded-lg border transition-colors ${
                                item.duplicate
                                  ? 'bg-orange-500/5 border-orange-500/30 ring-1 ring-orange-500/20'
                                  : item.status === 'done'
                                  ? 'bg-green-500/5 border-green-500/20'
                                  : item.status === 'error'
                                  ? 'bg-destructive/5 border-destructive/20'
                                  : item.status === 'uploading'
                                  ? 'bg-primary/5 border-primary/20'
                                  : 'bg-background/50 border-border'
                              }`}
                            >
                              <span className="text-xs text-muted-foreground w-6 sm:w-7 text-right shrink-0">{idx + 1}</span>
                              <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                                item.duplicate ? 'bg-orange-500/10' : 'bg-primary/10'
                              }`}>
                                {item.status === 'uploading' ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                ) : item.status === 'done' ? (
                                  <Music className="w-4 h-4 text-green-500" />
                                ) : item.duplicate ? (
                                  <X className="w-4 h-4 text-orange-500" />
                                ) : item.status === 'error' ? (
                                  <X className="w-4 h-4 text-destructive" />
                                ) : (
                                  <Music className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {item.status === 'done' ? (
                                  <p className="text-sm font-medium text-green-500 truncate">{item.title}</p>
                                ) : item.status === 'uploading' ? (
                                  <p className="text-sm font-medium text-primary truncate">{item.title}</p>
                                ) : (
                                  <Input
                                    value={item.title}
                                    onChange={(e) => updateItemTitle(idx, e.target.value)}
                                    className={`h-8 text-sm bg-transparent ${
                                      item.duplicate ? 'border-orange-500/50 text-orange-400 focus:ring-orange-500/30' : 'border-border'
                                    }`}
                                    placeholder="Song title"
                                    disabled={bulkUploading}
                                  />
                                )}
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                    {item.file.name} · {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                                  </p>
                                  {item.duplicate && item.duplicateReason && (
                                    <span className="text-[10px] sm:text-xs text-orange-500 font-medium shrink-0">
                                      ⚠ {item.duplicateReason}
                                    </span>
                                  )}
                                  {item.status === 'error' && item.error && (
                                    <span className="text-[10px] sm:text-xs text-destructive shrink-0">· {item.error}</span>
                                  )}
                                </div>
                              </div>
                              {!bulkUploading && item.status !== 'done' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeUploadItem(idx)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {item.status === 'done' && (
                                <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-500 shrink-0">Done</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Songs Tab */}
              <TabsContent value="songs">
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                      <h3 className="text-lg sm:text-xl font-semibold">Manage Songs ({songs.length})</h3>
                      {songs.length > 0 && (
                        <div className="flex items-center gap-2">
                          {bulkEditMode ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={exitBulkEdit} disabled={bulkSaving}>Cancel</Button>
                              <Button size="sm" onClick={handleBulkSave} disabled={bulkSaving}>
                                {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Edit2 className="w-3.5 h-3.5 mr-1.5" />}
                                {bulkSaving ? 'Saving...' : 'Save All Changes'}
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={enterBulkEdit}>
                              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                              Bulk Edit Titles
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {songs.length === 0 ? (
                      <p className="text-muted-foreground py-8 text-center">No songs uploaded yet</p>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {songs.map(song => (
                          <div key={song.id} className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-background/50 border border-border">
                            <div className="flex-1 min-w-0 mr-3">
                              {bulkEditMode ? (
                                <Input
                                  value={bulkEdits[song.id] || ''}
                                  onChange={(e) => setBulkEdits(prev => ({ ...prev, [song.id]: e.target.value }))}
                                  className={`h-8 text-sm bg-transparent ${
                                    bulkEdits[song.id] && bulkEdits[song.id].trim() !== song.title
                                      ? 'border-primary ring-1 ring-primary/30'
                                      : 'border-border'
                                  }`}
                                  disabled={bulkSaving}
                                />
                              ) : editingSongId === song.id ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="h-8 text-sm max-w-xs" autoFocus />
                                  <Button size="sm" onClick={() => handleEditSong(song.id)} className="h-8">Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingSongId(null); setEditingTitle(''); }} className="h-8">Cancel</Button>
                                </div>
                              ) : (
                                <>
                                  <h4 className="font-medium truncate text-sm sm:text-base">{song.title}</h4>
                                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-0.5 flex-wrap">
                                    <span>{song.plays || 0} plays</span>
                                    <span>{song.likes || 0} likes</span>
                                    <span className="hidden sm:inline">{timeAgo(song.createdAt)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                            {!bulkEditMode && (
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handlePlaySong(song)}><Play className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingSongId(song.id); setEditingTitle(song.title); }}><Edit2 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteSong(song.id)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments">
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold mb-4">All Comments ({allComments.length})</h3>
                    {allComments.length === 0 ? (
                      <p className="text-muted-foreground py-8 text-center">No comments yet</p>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {allComments.map(comment => (
                          <div key={comment.id} className="flex items-start justify-between p-3 sm:p-4 rounded-lg bg-background/50 border border-border">
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-xs sm:text-sm">{comment.name}</span>
                                <span className="text-xs text-muted-foreground">on</span>
                                <Badge variant="secondary" className="text-xs">{comment.songTitle || 'Unknown'}</Badge>
                                <span className="text-[10px] sm:text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground">{comment.text}</p>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => handleDeleteComment(comment.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Music className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xl sm:text-2xl font-bold">{songs.length}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">Total Songs</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xl sm:text-2xl font-bold">{songs.reduce((sum, s) => sum + (s.plays || 0), 0)}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">Total Plays</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-xl sm:text-2xl font-bold">{songs.reduce((sum, s) => sum + (s.likes || 0), 0)}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">Total Likes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {songs.length > 0 && (
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <h3 className="text-lg sm:text-xl font-semibold mb-4">Song Performance</h3>
                      <div className="h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={songs.map(s => ({
                            name: s.title.length > 12 ? s.title.substring(0, 12) + '...' : s.title,
                            Plays: s.plays || 0,
                            Likes: s.likes || 0,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'hsl(240 4% 16%)' : 'hsl(240 6% 90%)'} />
                            <XAxis dataKey="name" stroke={isDark ? 'hsl(240 5% 55%)' : 'hsl(240 4% 46%)'} fontSize={11} tickLine={false} />
                            <YAxis stroke={isDark ? 'hsl(240 5% 55%)' : 'hsl(240 4% 46%)'} fontSize={11} tickLine={false} />
                            <Tooltip contentStyle={{
                              backgroundColor: isDark ? 'hsl(240 10% 6.5%)' : 'hsl(0 0% 100%)',
                              border: `1px solid ${isDark ? 'hsl(240 4% 16%)' : 'hsl(240 6% 90%)'}`,
                              borderRadius: '8px',
                              color: isDark ? 'hsl(0 0% 95%)' : 'hsl(240 10% 3.9%)',
                            }} />
                            <Legend />
                            <Bar dataKey="Plays" fill="hsl(263 70% 50%)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Likes" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* ===== STICKY PLAYER + QUEUE ===== */}
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          {/* Queue Panel */}
          {showQueue && (
            <div className="bg-card/98 backdrop-blur-xl border-t border-border max-h-64 sm:max-h-72 overflow-y-auto">
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                    <ListOrdered className="w-4 h-4" />
                    Queue ({queue.length} songs)
                  </h3>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowQueue(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {queue.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Queue is empty</p>
                ) : (
                  <div className="space-y-0.5">
                    {queue.map((song, idx) => (
                      <div
                        key={`q-${song.id}-${idx}`}
                        className={`flex items-center gap-2 sm:gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          idx === queueIndex
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-secondary/50'
                        }`}
                        onClick={() => playFromQueue(idx)}
                      >
                        <span className="text-[10px] sm:text-xs text-muted-foreground w-5 sm:w-6 text-right shrink-0">
                          {idx === queueIndex ? (
                            <span className="text-primary">{isPlaying ? '▶' : '❚❚'}</span>
                          ) : idx + 1}
                        </span>
                        <span className="flex-1 text-xs sm:text-sm truncate">{song.title}</span>
                        {idx !== queueIndex && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Player Bar */}
          <div className="bg-card/95 backdrop-blur-xl border-t border-border">
            {/* Thin progress bar at very top */}
            <div
              className="w-full h-1 bg-muted cursor-pointer group sm:hidden"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                handleSeek(pct * duration);
              }}
            >
              <div
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
              {/* Mobile Layout */}
              <div className="flex sm:hidden items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Disc3 className={`w-5 h-5 text-primary ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentSong.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playPrev}>
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-9 w-9 rounded-full bg-foreground text-background hover:bg-foreground/90"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playNext}>
                    <SkipForward className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className={`h-8 w-8 ${showQueue ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setShowQueue(!showQueue)}
                  >
                    <ListMusic className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:flex items-center gap-4">
                {/* Song Info */}
                <div className="flex items-center gap-3 min-w-0 w-[220px]">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Disc3 className={`w-5 h-5 text-primary ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{currentSong.title}</p>
                    <p className="text-xs text-muted-foreground">ATTIKID</p>
                  </div>
                </div>

                {/* Center Controls */}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon" variant="ghost"
                      className={`h-8 w-8 ${shuffleMode ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={toggleShuffle}
                    >
                      <Shuffle className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playPrev}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-full bg-foreground text-background hover:bg-foreground/90"
                      onClick={togglePlay}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playNext}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className={`h-8 w-8 ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={cycleRepeat}
                    >
                      <RepeatIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 w-full max-w-lg">
                    <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      value={currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="flex-1 h-1 rounded-full"
                      style={{
                        background: `linear-gradient(to right, hsl(var(--primary)) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, hsl(var(--muted)) ${duration > 0 ? (currentTime / duration) * 100 : 0}%)`
                      }}
                    />
                    <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Right: Queue + Volume */}
                <div className="flex items-center gap-1 w-[200px] justify-end">
                  <Button
                    size="icon" variant="ghost"
                    className={`h-8 w-8 ${showQueue ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setShowQueue(!showQueue)}
                  >
                    <ListMusic className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleMute}>
                    <VolumeIcon className="w-4 h-4" />
                  </Button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume * 100}
                    onChange={(e) => handleVolume(Number(e.target.value))}
                    className="w-20 h-1 rounded-full"
                    style={{
                      background: `linear-gradient(to right, hsl(var(--primary)) ${isMuted ? 0 : volume * 100}%, hsl(var(--muted)) ${isMuted ? 0 : volume * 100}%)`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
