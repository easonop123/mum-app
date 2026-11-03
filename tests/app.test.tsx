import { describe, expect, it, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import type { AppData } from '../src/data/schema';
import { I18nProvider } from '../src/i18n/I18n';
import { AutoUpdate } from '../src/pwa/UpdateBanner';
import { VideoDemo } from '../src/ui/components/VideoDemo';
import { VIDEO_ENTRIES } from '../src/content/videos';
import { fixedNow, freshData, startedData } from './appStates';

function renderApp(data: AppData, hash = '#/') {
  window.location.hash = hash;
  return render(<App store={{ initialData: data, now: fixedNow }} />);
}

async function goTo(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('getting started', () => {
  it('one welcome screen, then practice is available straight away — no questions', async () => {
    const user = userEvent.setup();
    renderApp(freshData());
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Let's start" }));
    expect(await screen.findByRole('link', { name: "Start today's practice" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Smaller practice/ })).toBeInTheDocument();
    expect(screen.getByText('Chair sit-to-stand — 1 set · 5 repetitions')).toBeInTheDocument();
    expect(screen.queryByText(/paused|waiting for medical advice|questions/i)).not.toBeInTheDocument();
  });

  it('switches to Simplified Chinese with localized labels and document language', async () => {
    const user = userEvent.setup();
    renderApp(startedData());
    await user.click(await screen.findByRole('button', { name: /Switch to Simplified Chinese/ }));
    expect(await screen.findByRole('link', { name: '开始今天的练习' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-Hans');
    expect(screen.getByRole('navigation', { name: '主菜单' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /切换到英文/ }));
    expect(await screen.findByRole('link', { name: "Start today's practice" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en-NZ');
  });
});

describe('a practice', () => {
  it('starts with one tap, records only what is tapped, and saves automatically at the end', async () => {
    const user = userEvent.setup();
    renderApp(startedData());
    await user.click(await screen.findByRole('link', { name: "Start today's practice" }));
    expect(await screen.findByRole('heading', { name: 'Warm-up: easy walking' })).toBeInTheDocument();
    expect(screen.getByText('A fixed kitchen counter to hold for the standing movements.')).toBeInTheDocument();
    expect(screen.getByTestId('stop-button')).toHaveTextContent('停止 / Stop');
    await user.click(screen.getByRole('button', { name: 'Done walking' }));

    expect(screen.getByRole('heading', { name: 'Chair sit-to-stand' })).toBeInTheDocument();
    expect(screen.getByText('1 set · 5 repetitions')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull(); // nothing loads until "Watch" is tapped
    await user.click(screen.getByRole('button', { name: 'Done: 5' }));
    await user.click(screen.getByRole('button', { name: "I'm ready — next" }));

    expect(screen.getByRole('heading', { name: 'Wall press-up' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I did fewer' }));
    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(screen.getByRole('button', { name: "I'm ready — next" }));

    expect(screen.getByRole('heading', { name: 'Supported heel raise' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip this movement' }));
    await user.click(screen.getByRole('button', { name: 'Yes, skip it' }));

    expect(screen.getByRole('heading', { name: 'Supported side leg lift' })).toBeInTheDocument();
    expect(screen.getByText('1 set · 5 each side')).toBeInTheDocument();
    expect(screen.getByText(/Set 1 of 1 · Left side/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done: 5' }));
    expect(screen.getByRole('heading', { name: 'Change sides. Take 30–60 seconds.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "I'm ready — next" }));
    expect(screen.getByText(/Set 1 of 1 · Right side/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done: 5' }));

    // No end-of-practice questions: it is saved straight away.
    const done = await screen.findByTestId('finished-view');
    expect(done).toHaveTextContent('You did part of the practice — that still counts.');
    expect(done).toHaveTextContent('Movements done today: 18');

    await goTo('#/progress');
    expect(await screen.findByText('Active 1 time this week')).toBeInTheDocument();
    expect(screen.getByText(/Part of the practice · 18/)).toBeInTheDocument();
  });

  it('Stop asks once, saves what was done, shows help numbers and locks nothing', async () => {
    const user = userEvent.setup();
    renderApp(startedData());
    await user.click(await screen.findByRole('link', { name: "Start today's practice" }));
    await user.click(await screen.findByRole('button', { name: 'Skip the warm-up' }));
    await user.click(screen.getByRole('button', { name: 'Done: 5' }));
    await user.click(screen.getByTestId('stop-button'));
    expect(screen.getByRole('heading', { name: 'Stop now?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(screen.getByRole('heading', { name: /Rest|Change sides/ })).toBeInTheDocument();
    await user.click(screen.getByTestId('stop-button'));
    await user.click(screen.getByRole('button', { name: 'Yes, stop' }));
    expect(await screen.findByTestId('stopped-view')).toHaveTextContent('What you did is saved.');
    expect(screen.getAllByRole('link', { name: /111/ })[0]).toHaveAttribute('href', 'tel:111');
    await goTo('#/');
    expect(await screen.findByText('You practised today. Well done.')).toBeInTheDocument();
    expect(screen.queryByText(/paused/i)).not.toBeInTheDocument();
  });
});

describe('the plan', () => {
  it('she can choose her own stage from the supplied table', async () => {
    const user = userEvent.setup();
    renderApp(startedData(), '#/plan');
    expect(await screen.findByText('You are on Stage 1.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use Stage 3' }));
    expect(screen.getByText('Changed to Stage 3.')).toBeInTheDocument();
    await goTo('#/');
    expect(await screen.findByText('Chair sit-to-stand — 2 sets · 8 repetitions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stage 3 of 8' })).toBeInTheDocument();
  });
});

describe('demonstration videos (cases 12–15)', () => {
  const heel = VIDEO_ENTRIES.find((e) => e.videoId === 'zpIkRgojpiY')!;

  it('loads nothing until tapped, then uses the privacy-enhanced embed; "it didn\'t play" shows a fallback', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider lang="en">
        <VideoDemo entry={heel} />
      </I18nProvider>,
    );
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByTestId('dose-note')).toHaveTextContent('视频用来看动作；次数和组数请按本页安排，不跟随视频加量。');
    expect(screen.getByRole('link', { name: 'Open on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=zpIkRgojpiY');
    await user.click(screen.getByRole('button', { name: '看示范 / Watch demonstration' }));
    expect(document.querySelector('iframe')?.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/zpIkRgojpiY/);
    await user.click(screen.getByRole('button', { name: "It didn't play" }));
    expect(screen.getByText(/didn't play here/)).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('offline: never pretends the video is available', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(
      <I18nProvider lang="zh">
        <VideoDemo entry={heel} />
      </I18nProvider>,
    );
    expect(screen.getByText('现在没有联网，视频打不开。请看下面的文字说明。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /看示范/ })).toBeDisabled();
    spy.mockRestore();
  });
});

describe('integrity and explicit actions', () => {
  it('never renders typed or imported HTML', async () => {
    const data = startedData();
    data.profile.encouragementNote = '<img src="x" onerror="alert(1)">Keep going';
    renderApp(data);
    expect(await screen.findByText('<img src="x" onerror="alert(1)">Keep going')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('deleting needs typed confirmation; a backup shows what it contains first (case 22)', async () => {
    const user = userEvent.setup();
    renderApp(startedData(), '#/settings/data');
    expect(await screen.findByRole('heading', { name: 'My data' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save backup file' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save a backup' }));
    expect(screen.getByText('0 practice records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save backup file' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete my data…' }));
    const del = screen.getByRole('button', { name: 'Delete everything' });
    expect(del).toBeDisabled();
    await user.type(screen.getByLabelText(/To confirm, type DELETE/), 'DELETE');
    expect(del).toBeEnabled();
  });

  it('app updates apply automatically only when she is not practising (case 21)', async () => {
    const apply = vi.fn(async () => undefined);
    const source = { subscribe: (l: (w: boolean) => void) => (l(true), () => undefined), apply };
    const { rerender } = render(<AutoUpdate source={source} hasActiveSession routePath="/session" />);
    expect(apply).not.toHaveBeenCalled();
    rerender(<AutoUpdate source={source} hasActiveSession={false} routePath="/session/full" />);
    expect(apply).not.toHaveBeenCalled();
    rerender(<AutoUpdate source={source} hasActiveSession={false} routePath="/" />);
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  });
});
