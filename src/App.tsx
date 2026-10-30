import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Download, Minus, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Settings2, Sun, X } from 'lucide-react';
import { imageData, readerRequest, type Chapter, type ChapterSummary, type StorySummary } from './api';

type Preferences = { theme: 'dark' | 'paper' | 'light'; font: 'serif' | 'sans'; size: number; line: number; width: number; tint: string };
const initialPreferences: Preferences = { theme: 'dark', font: 'serif', size: 19, line: 1.9, width: 680, tint: '#1e1e1e' };
function readPrefs(): Preferences { try { return { ...initialPreferences, ...JSON.parse(localStorage.getItem('esreader.preferences') || '{}') }; } catch { return initialPreferences; } }
function readLast(): { story?: string; chapter?: string } { try { return JSON.parse(localStorage.getItem('esreader.last') || '{}'); } catch { return {}; } }

export default function App() {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [story, setStory] = useState<StorySummary | null>(null);
  const [chapterId, setChapterId] = useState('');
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [cover, setCover] = useState('');
  const [storyCovers, setStoryCovers] = useState<Record<string, string>>({});
  const [appVersion, setAppVersion] = useState('');
  const [prefs, setPrefs] = useState(readPrefs);
  const [navVisible, setNavVisible] = useState(true);
  const [drawer, setDrawer] = useState<'chapters' | 'settings' | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [account, setAccount] = useState<{ id: string; email: string; name: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle', currentVersion: '1.0.0' });
  const [bookmarks, setBookmarks] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('esreader.bookmarks') || '[]'); } catch { return []; } });

  const loadStories = useCallback(async (resume = false) => {
    setBusy(true); setError('');
    try {
      const result = await readerRequest<StorySummary[]>('/api/reader/stories');
      setStories(result);
      void Promise.all(result.map(async item => {
        if (!item.cover) return null;
        try { return [item.id, await imageData(item.cover)] as const; } catch { return null; }
      })).then(entries => setStoryCovers(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null))));
      if (resume && result.length) {
        const last = readLast();
        const saved = result.find(item => item.id === last.story);
        if (saved) await openStory(saved, last.chapter);
      }
    } catch (err) { setError((err as Error).message || 'Could not reach estory.fauzulazim.com. Check your connection and try again.'); }
    finally { setBusy(false); }
  }, []);

  const openStory = useCallback(async (selected: StorySummary, startChapter?: string) => {
    setStory(selected); setChapter(null); setError(''); setCover('');
    try {
      const full = await readerRequest<StorySummary>(`/api/reader/stories/${selected.id}`);
      setStory(full);
      if (full.cover) imageData(full.cover).then(setCover).catch(() => {});
      const target = full.chapters.find(item => item.id === startChapter) ?? full.chapters[0];
      if (target) await openChapter(full, target.id);
    } catch (err) { setError((err as Error).message); }
  }, []);

  const openChapter = useCallback(async (selected: StorySummary, id: string) => {
    setChapterId(id); setChapter(null); setError(''); setDrawer(null); setProgress(0);
    localStorage.setItem('esreader.last', JSON.stringify({ story: selected.id, chapter: id }));
    const key = `esreader.progress.${selected.id}.${id}`;
    setProgress(Number(localStorage.getItem(key) || 0));
    try { setChapter(await readerRequest<Chapter>(`/api/reader/stories/${selected.id}/chapters/${id}`)); }
    catch (err) { setError((err as Error).message); }
  }, []);

  useEffect(() => { void (async () => { const user = await window.desktop.session(); setAccount(user); if (user) await loadStories(true); else setBusy(false); })(); }, [loadStories]);
  useEffect(() => { void window.desktop.update.getStatus().then(setUpdateStatus); return window.desktop.update.onStatus(setUpdateStatus); }, []);
  useEffect(() => { void window.desktop.version().then(setAppVersion); }, []);
  useEffect(() => { localStorage.setItem('esreader.preferences', JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => { localStorage.setItem('esreader.bookmarks', JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => {
    if (!story || !chapter) return;
    const update = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const value = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
      setProgress(value);
      localStorage.setItem(`esreader.progress.${story.id}.${chapter.id}`, String(value));
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [story?.id, chapter?.id, chapter]);
  useEffect(() => {
    if (!story || !chapter) return;
    const saved = Number(localStorage.getItem(`esreader.progress.${story.id}.${chapter.id}`) || 0);
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, max * saved), behavior: 'instant' });
    });
  }, [story?.id, chapter?.id]);

  const chapterIndex = story?.chapters.findIndex(item => item.id === chapterId) ?? -1;
  const filtered = useMemo(() => stories.filter(item => `${item.title} ${item.synopsis} ${item.genres?.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [stories, query]);
  const move = (offset: number) => { if (!story) return; const target = story.chapters[chapterIndex + offset]; if (target) void openChapter(story, target.id); };
  const toggleBookmark = () => { if (!story || !chapter) return; const id = `${story.id}:${chapter.id}`; setBookmarks(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]); };
  const bookmarked = Boolean(story && chapter && bookmarks.includes(`${story.id}:${chapter.id}`));

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'Escape') { if (drawer) setDrawer(null); else if (story) { setStory(null); setChapter(null); } }
      if (event.key === 'ArrowRight' && story && chapter) move(1);
      if (event.key === 'ArrowLeft' && story && chapter) move(-1);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); setNavVisible(value => !value); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [drawer, story, chapter, chapterIndex]);

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPrefs(old => ({ ...old, [key]: value }));
  const style = { '--reader-bg': prefs.theme === 'dark' ? prefs.tint : prefs.theme === 'paper' ? '#eee7d7' : '#f7f7f5', '--reader-ink': prefs.theme === 'dark' ? '#d4d4d4' : prefs.theme === 'paper' ? '#403d35' : '#2f3733', '--reader-muted': prefs.theme === 'dark' ? '#858585' : '#858b82', '--reader-line': prefs.line, '--reader-size': `${prefs.size}px`, '--reader-width': `${prefs.width}px`, '--reader-font': prefs.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'Inter, system-ui, sans-serif' } as React.CSSProperties;

  const signIn = async (event: React.FormEvent) => { event.preventDefault(); setSigningIn(true); setError(''); try { const user = await window.desktop.login({ email, password }); setAccount(user); setPassword(''); await loadStories(true); } catch (err) { setError((err as Error).message); } finally { setSigningIn(false); } };
  const updateAction = async () => {
    if (updateStatus.status === 'available') await window.desktop.update.download();
    else if (updateStatus.status === 'downloaded') await window.desktop.update.install();
    else await window.desktop.update.check();
  };
  const updateLabel = updateStatus.status === 'available' ? `Download update ${updateStatus.availableVersion}` : updateStatus.status === 'downloaded' ? `Restart to install ${updateStatus.availableVersion}` : updateStatus.status === 'downloading' ? `Downloading update ${updateStatus.percent ?? 0}%` : updateStatus.status === 'checking' ? 'Checking for updates' : updateStatus.status === 'not-available' ? 'You have the latest version' : updateStatus.status === 'error' ? `Update check failed: ${updateStatus.message || 'Unknown error'}` : updateStatus.status === 'unsupported' ? updateStatus.message || 'Updates require the installed app' : 'Check for updates';

  return <main className={`app theme-${prefs.theme}`} style={style}>
    <header className={`titlebar ${navVisible ? '' : 'titlebar-hidden'}`} onMouseEnter={() => !navVisible && setNavVisible(true)}>
      <div className="drag-space"><BookOpen size={14} /><span>esReader</span><span className="app-version">v{appVersion || '…'}</span>{story && <><span className="crumb-sep">/</span><span className="window-story">{story.title}</span></>}</div>
      <button className="chrome-button update-button" title={updateLabel} aria-label={updateLabel} onClick={() => void updateAction()} disabled={['checking', 'downloading', 'unsupported'].includes(updateStatus.status)}>{updateStatus.status === 'available' || updateStatus.status === 'downloaded' ? <Download size={14} /> : <RefreshCw size={13} className={updateStatus.status === 'checking' ? 'spin' : ''} />}</button>
      <button className="chrome-button" title="Hide reader bar · Ctrl+B" onClick={() => setNavVisible(false)}><PanelLeftClose size={15} /></button>
      <div className="window-actions"><button title="Minimize" onClick={() => window.desktop.windowAction('minimize')}><Minus size={14} /></button><button title="Maximize" onClick={() => window.desktop.windowAction('toggle-maximize')}><span className="maximize-icon" /></button><button title="Close" onClick={() => window.desktop.windowAction('close')}><X size={15} /></button></div>
    </header>
    {!navVisible && <button className="show-toolbar" title="Show toolbar (Ctrl+B)" onClick={() => setNavVisible(true)}><PanelLeftOpen size={14} /><span>Show toolbar</span></button>}
    {!account ? <section className="login-panel"><span className="overline">YOUR ESTORY LIBRARY</span><h1>Welcome back</h1><p>Sign in with your esTory account to open your reading room.</p><form onSubmit={signIn}><label>Username or email<input type="text" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p className="login-error">{error}</p>}<button className="begin-button" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'} <ArrowRight size={15} /></button></form><button className="login-link" onClick={() => window.desktop.openSite()}>Open esTory in your browser</button></section> : <>
    {story && chapter ? <>
      <div className="reading-progress"><span style={{ width: `${progress * 100}%` }} /></div>
      <section className="reading-top">
        <button className="quiet-button back" onClick={() => { setStory(null); setChapter(null); setError(''); }}><ArrowLeft size={15} /> Library</button>
        <button className="quiet-button story-picker" title="Browse chapters" onClick={() => setDrawer(drawer === 'chapters' ? null : 'chapters')}>{story.title}<ChevronDown size={14} /></button>
        <button className={`quiet-button bookmark ${bookmarked ? 'active' : ''}`} title={bookmarked ? 'Remove bookmark' : 'Bookmark this chapter'} onClick={toggleBookmark}><span>{bookmarked ? '★' : '☆'}</span></button>
        <button className="quiet-button" title="Reading preferences" onClick={() => setDrawer(drawer === 'settings' ? null : 'settings')}><Settings2 size={16} /></button>
      </section>
      {chapter && <article className="article" key={chapter.id}>
        <div className="chapter-heading"><span className="overline">CHAPTER {String(chapter.number).padStart(2, '0')}</span><h1>{chapter.title}</h1><p>{Math.max(1, Math.ceil(chapter.wordCount / 220))} min <span>·</span> {chapter.wordCount.toLocaleString()} words</p><i>✦</i></div>
        <div className="prose"><ReactMarkdown>{chapter.content}</ReactMarkdown></div>
        <div className="chapter-end">✦　✦　✦</div>
        <nav className="chapter-nav">
          <button disabled={chapterIndex <= 0} onClick={() => move(-1)}><ChevronLeft size={17} /><span><small>PREVIOUS</small>{story.chapters[chapterIndex - 1]?.title || 'Beginning'}</span></button>
          <button disabled={chapterIndex >= story.chapters.length - 1} onClick={() => move(1)}><span><small>{chapterIndex >= story.chapters.length - 1 ? 'UP TO DATE' : 'NEXT CHAPTER'}</small>{story.chapters[chapterIndex + 1]?.title || 'Latest chapter'}</span><ChevronRight size={17} /></button>
        </nav>
      </article>}
      <footer className="reader-footer"><button onClick={() => setDrawer('chapters')}>Chapter {chapter.number} of {story.chapters.length} <ChevronDown size={13} /></button><span>{Math.round(progress * 100)}%</span><div><button disabled={chapterIndex <= 0} onClick={() => move(-1)}><ArrowLeft size={14} /></button><button disabled={chapterIndex >= story.chapters.length - 1} onClick={() => move(1)}><ArrowRight size={14} /></button></div></footer>
    </> : story ? <>
      <section className="story-intro"><button className="quiet-button back" onClick={() => { setStory(null); setChapter(null); }}><ArrowLeft size={15} /> Library</button>
        {cover && <img className="intro-cover" src={cover} alt="" />}
        <span className="overline">A STORY TO GET LOST IN</span><h1>{story.title}</h1>{story.subtitle && <h2>{story.subtitle}</h2>}<p>{story.synopsis}</p><div className="story-meta">{story.chapters.length} published chapters <span>·</span> {story.language}</div>
        <button className="begin-button" disabled={!story.chapters.length} onClick={() => void openChapter(story, story.chapters[0].id)}><BookOpen size={16} /> Begin reading <ArrowRight size={15} /></button>
        <button className="outline-button" onClick={() => setDrawer('chapters')}>Browse chapters <ChevronRight size={14} /></button>
      </section>
    </> : <>
      <section className="library-head"><div><span className="overline">PUBLISHED STORIES</span><h1>Reading room</h1></div><label className="search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a story" /></label></section>
      {busy ? <div className="quiet-state">Opening the reading room…</div> : error ? <div className="quiet-state error-state"><p>{error}</p><button className="outline-button" onClick={() => void loadStories()}>Try again <ArrowRight size={14} /></button></div> : filtered.length ? <section className="story-list">{filtered.map(item => <button className="story-card" key={item.id} onClick={() => void openStory(item)}>
          <span className={`card-cover ${storyCovers[item.id] ? 'has-cover' : ''}`} aria-hidden="true">{storyCovers[item.id] ? <img src={storyCovers[item.id]} alt="" /> : <><BookOpen size={16} className="cover-mark" /><span>{item.title}</span></>}</span>
          <span className="card-copy"><strong>{item.title}</strong><small>{item.genres?.join(' · ') || item.language}</small><small>{item.chapters.length} published {item.chapters.length === 1 ? 'chapter' : 'chapters'}</small></span><ArrowRight size={15} className="card-arrow" />
        </button>)}</section> : <div className="quiet-state">No published stories found.</div>}
      <div className="library-foot"><span>esReader v{appVersion || '…'}</span><span>·</span><span>estory.fauzulazim.com</span><span>·</span><span>{stories.length} stories</span></div>
    </>}
    {error && story && <div className="inline-error"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={13} /></button></div>}
    {drawer && <><button className="drawer-shade" aria-label="Close panel" onClick={() => setDrawer(null)} /><aside className="drawer"><header><h2>{drawer === 'settings' ? 'Reading appearance' : 'Chapters'}</h2><button className="quiet-button" onClick={() => setDrawer(null)} aria-label="Close"><X size={16} /></button></header>
      {drawer === 'settings' ? <div className="settings">
        <label>Theme<div className="theme-select">{(['dark', 'paper', 'light'] as const).map(theme => <button className={prefs.theme === theme ? 'selected' : ''} key={theme} onClick={() => updatePref('theme', theme)}>{theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}{theme === 'dark' ? 'Dark' : theme === 'paper' ? 'Paper' : 'Light'}</button>)}</div></label>
        {prefs.theme === 'dark' && <label>Editor shade <span>{prefs.tint}</span><input type="color" value={prefs.tint} onChange={event => updatePref('tint', event.target.value)} /></label>}
        <label>Typeface<div className="theme-select"><button className={prefs.font === 'serif' ? 'selected' : ''} onClick={() => updatePref('font', 'serif')}>Serif</button><button className={prefs.font === 'sans' ? 'selected' : ''} onClick={() => updatePref('font', 'sans')}>Sans</button></div></label>
        <label>Text size <span>{prefs.size}px</span><input type="range" min="14" max="30" value={prefs.size} onChange={event => updatePref('size', Number(event.target.value))} /></label>
        <label>Line spacing <span>{prefs.line.toFixed(1)}</span><input type="range" min="1.4" max="2.5" step="0.1" value={prefs.line} onChange={event => updatePref('line', Number(event.target.value))} /></label>
        <label>Text column <span>{prefs.width}px</span><input type="range" min="320" max="900" step="20" value={prefs.width} onChange={event => updatePref('width', Number(event.target.value))} /></label>
        <p>Appearance and reading position are saved on this device.</p><button className="reset-button" onClick={() => setPrefs(initialPreferences)}>Reset appearance</button>
      </div> : <div className="chapter-list">{story?.chapters.map(item => <ChapterRow key={item.id} item={item} active={item.id === chapterId} onClick={() => story && void openChapter(story, item.id)} />)}</div>}
    </aside></>}
    </>}
  </main>;
}

function ChapterRow({ item, active, onClick }: { item: ChapterSummary; active: boolean; onClick: () => void }) {
  return <button className={`chapter-row ${active ? 'active' : ''}`} onClick={onClick}><span className="chapter-number">{String(item.number).padStart(2, '0')}</span><span className="chapter-copy"><strong>{item.title}</strong><small>{Math.max(1, Math.ceil(item.wordCount / 220))} min read</small></span>{active && <BookOpen size={15} />}</button>;
}
