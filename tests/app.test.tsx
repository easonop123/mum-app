import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import type { AppData } from '../src/data/schema';
import { I18nProvider } from '../src/i18n/I18n';
import { UpdateBanner } from '../src/pwa/UpdateBanner';
import { VideoDemo } from '../src/ui/components/VideoDemo';
import { VIDEO_ENTRIES } from '../src/content/videos';
import { fixedNow, freshData, onboardedData, reviewedData } from './appStates';

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

describe('onboarding and choice', () => {
  it('starts with a choice, and "Not now" is respected without pressure', async () => {
    const user = userEvent.setup();
    renderApp(freshData());
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.getByRole('heading', { name: "That's fine" })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "I'd like to look now" }));
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
  });

  it('an emergency answer interrupts and blocks every workout route, including direct URLs (case 1)', async () => {
    const user = userEvent.setup();
    renderApp(freshData());
    await user.click(await screen.findByRole('button', { name: "Yes, let's have a look" }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Yes, New Zealand' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('radio', { name: 'Yes, one or more' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // A single confirmation step guards against a mis-tap; it is not a bypass.
    await user.click(screen.getByRole('button', { name: "Yes, that's right" }));
    const view = await screen.findByTestId('emergency-view');
    expect(view).toHaveTextContent('先停止练习。这些新出现的症状需要立即寻求医疗帮助，不要继续测试动作。');
    expect(screen.getAllByRole('link', { name: /111/ })[0]).toHaveAttribute('href', 'tel:111');
    expect(screen.getByRole('link', { name: /0800 611 116/ })).toHaveAttribute('href', 'tel:0800611116');
    for (const hash of ['#/session/full', '#/session/tiny', '#/learn', '#/plan']) {
      await goTo(hash);
      expect(await screen.findByTestId('emergency-view')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
      expect(screen.queryByText(/try seated|just walk/i)).not.toBeInTheDocument();
    }
  });
});

describe('assessment pending (case 25)', () => {
  it('shows a clear waiting status with learn-only options and no practice buttons', async () => {
    renderApp(onboardedData());
    expect(await screen.findByTestId('waiting-card')).toHaveTextContent('Your plan is waiting for medical advice');
    expect(screen.queryByRole('link', { name: "Start today's practice" })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Smaller practice/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Learn the movements — watch and read only/ })).toBeInTheDocument();
    await goTo('#/session/tiny');
    expect(await screen.findByTestId('practice-blocked')).toHaveTextContent('waits until a GP or physiotherapist');
  });
});

describe('language', () => {
  it('switches to Simplified Chinese with localized labels and document language', async () => {
    const user = userEvent.setup();
    renderApp(reviewedData());
    await user.click(await screen.findByRole('button', { name: /Switch to Simplified Chinese/ }));
    expect(await screen.findByRole('link', { name: '开始今天的练习' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-Hans');
    expect(screen.getByRole('navigation', { name: '主菜单' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /切换到英文/ }));
    expect(await screen.findByRole('link', { name: "Start today's practice" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en-NZ');
  });
});

describe('a practice session', () => {
  it('records only what is tapped, including fewer reps, skips and left/right sides', async () => {
    const user = userEvent.setup();
    renderApp(reviewedData());
    await user.click(await screen.findByRole('link', { name: "Start today's practice" }));
    await user.click(screen.getByRole('radio', { name: 'No, nothing new' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
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

    expect(screen.getByText(/saved as a partial practice/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Comfortable' }));
    await user.click(within(screen.getByRole('group', { name: 'Did the movements feel controlled?' })).getByRole('radio', { name: 'Yes' }));
    await user.click(within(screen.getByRole('group', { name: 'At the end, could you have done a few more?' })).getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Save and finish' }));
    expect(await screen.findByRole('heading', { name: 'Saved' })).toBeInTheDocument();

    await goTo('#/progress');
    expect(await screen.findByText('Active 1 time this week')).toBeInTheDocument();
    expect(screen.getByText(/Part of the practice · 18/)).toBeInTheDocument();
  });

  it('"Not sure" at the check-in holds today’s practice instead of treating it as low risk (case 3)', async () => {
    const user = userEvent.setup();
    renderApp(reviewedData());
    await user.click(await screen.findByRole('link', { name: "Start today's practice" }));
    await user.click(screen.getByRole('radio', { name: 'Not sure' }));
    const groups = screen.getAllByRole('group');
    await user.click(within(groups[1]!).getByRole('radio', { name: 'No, none of these' }));
    await user.click(within(groups[2]!).getByRole('radio', { name: 'No, none of these' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByTestId('held-view')).toBeInTheDocument();
    await goTo('#/');
    expect(await screen.findByTestId('waiting-card')).toHaveTextContent('Practice is paused for now');
    expect(screen.queryByRole('link', { name: /Smaller practice/ })).not.toBeInTheDocument();
  });

  it('Stop → new numbness ends the session, saves partial work and routes to advice (no substitute exercise)', async () => {
    const user = userEvent.setup();
    renderApp(reviewedData());
    await user.click(await screen.findByRole('link', { name: "Start today's practice" }));
    await user.click(screen.getByRole('radio', { name: 'No, nothing new' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Skip the warm-up' }));
    await user.click(screen.getByRole('button', { name: 'Done: 5' }));
    await user.click(screen.getByTestId('stop-button'));
    await user.click(screen.getByRole('radio', { name: 'New numbness, tingling, weakness, or pain that spreads' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/Practice is paused. Please get advice/)).toBeInTheDocument();
    expect(screen.queryByText(/try|instead/i)).not.toBeInTheDocument();
    await goTo('#/');
    expect(await screen.findByTestId('urgent-view')).toBeInTheDocument();
  });
});

describe('demonstration videos (cases 12–15)', () => {
  const heel = VIDEO_ENTRIES.find((e) => e.videoId === 'zpIkRgojpiY')!;

  it('loads nothing until tapped, then uses the privacy-enhanced embed; "it didn\'t play" shows a truthful fallback', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider lang="en">
        <VideoDemo entry={heel} />
      </I18nProvider>,
    );
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByTestId('dose-note')).toHaveTextContent('视频用来看动作；次数和组数请按本页安排，不跟随视频加量。');
    expect(screen.getByText(/Not saved for offline use/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=zpIkRgojpiY');
    await user.click(screen.getByRole('button', { name: '看示范 / Watch demonstration' }));
    expect(document.querySelector('iframe')?.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/zpIkRgojpiY/);
    await user.click(screen.getByRole('button', { name: "It didn't play" }));
    expect(screen.getByText(/didn't play here/)).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: '再看一次 / Watch again' })).toBeInTheDocument();
  });

  it('offline: never pretends the video is available', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const onUnavailable = vi.fn();
    render(
      <I18nProvider lang="zh">
        <VideoDemo entry={heel} onUnavailable={onUnavailable} />
      </I18nProvider>,
    );
    expect(screen.getByText('现在没有联网，视频打不开。请看下面的文字说明。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /看示范/ })).toBeDisabled();
    expect(onUnavailable).toHaveBeenCalledWith(true);
    spy.mockRestore();
  });
});

describe('integrity and explicit actions', () => {
  it('never renders imported or typed HTML', async () => {
    const data = reviewedData();
    data.profile.encouragementNote = '<img src="x" onerror="alert(1)">Keep going';
    renderApp(data);
    expect(await screen.findByText('<img src="x" onerror="alert(1)">Keep going')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('delete needs a review step and typed confirmation; export needs a privacy preview (case 22)', async () => {
    const user = userEvent.setup();
    renderApp(reviewedData(), '#/settings/data');
    expect(await screen.findByRole('heading', { name: 'My data' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save backup file' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review what will be saved' }));
    expect(screen.getByText('12 health answers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save backup file' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review what will be deleted' }));
    const del = screen.getByRole('button', { name: 'Delete everything' });
    expect(del).toBeDisabled();
    await user.type(screen.getByLabelText(/To confirm, type DELETE/), 'DELETE');
    expect(del).toBeEnabled();
  });

  it('the update banner never appears during a practice (case 21)', async () => {
    const apply = vi.fn(async () => undefined);
    const source = { subscribe: (l: (w: boolean) => void) => (l(true), () => undefined), apply };
    const { rerender } = render(
      <I18nProvider lang="en">
        <UpdateBanner source={source} hasActiveSession routePath="/session" />
      </I18nProvider>,
    );
    expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
    rerender(
      <I18nProvider lang="en">
        <UpdateBanner source={source} hasActiveSession={false} routePath="/" />
      </I18nProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Update now' }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  });
});
