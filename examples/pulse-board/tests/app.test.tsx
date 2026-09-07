import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { STORAGE_KEY } from '@/types';

describe('App smoke', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders identity strip and add form', () => {
    render(<App />);
    expect(screen.getByText('Pulse Board')).toBeTruthy();
    expect(screen.getByTestId('add-card-submit')).toBeTruthy();
  });

  it('adds a card when form is submitted', () => {
    render(<App />);
    const addPanel = screen.getByTestId('add-card-panel');

    fireEvent.change(within(addPanel).getByLabelText('Title'), { target: { value: 'Deploy' } });
    fireEvent.change(within(addPanel).getByLabelText('Status'), { target: { value: 'green' } });
    fireEvent.change(within(addPanel).getByLabelText('Note'), { target: { value: 'Pipeline green' } });
    fireEvent.click(within(addPanel).getByTestId('add-card-submit'));

    expect(screen.getByText('Deploy')).toBeTruthy();
    expect(screen.getByText('Pipeline green')).toBeTruthy();
    expect(within(screen.getByTestId('status-card')).getByText('OK')).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Deploy');
  });

  it('clears all cards after confirm', () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<App />);
    const addPanel = screen.getByTestId('add-card-panel');
    fireEvent.change(within(addPanel).getByLabelText('Title'), { target: { value: 'Temp' } });
    fireEvent.click(within(addPanel).getByTestId('add-card-submit'));
    expect(screen.getByText('Temp')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByText('Temp')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    vi.unstubAllGlobals();
  });
});
