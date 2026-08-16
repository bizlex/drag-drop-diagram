import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourceTextPanel } from './SourceTextPanel';
import { makeDocument } from '../../domain/diagram/testFixtures';

describe('SourceTextPanel', () => {
  it('creates from source text and validates whitespace-only input', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SourceTextPanel document={null} draftSourceText="" onDraftChange={vi.fn()} onCreate={onCreate} onReset={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Create diagram' }));
    expect(screen.getByRole('alert')).toHaveTextContent('at least one non-whitespace');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('locks source text and displays available tokens in order', () => {
    render(<SourceTextPanel document={makeDocument()} draftSourceText="same same" onDraftChange={vi.fn()} onCreate={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByLabelText('Source text input')).toHaveAttribute('readonly');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['same', 'same']);
  });

  it('requires confirmation before destructive reset and can cancel', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<SourceTextPanel document={{ ...makeDocument(), elements: [{ id: 'word-1', type: 'word', tokenId: 'token-1', x: 1, y: 2 }] }} draftSourceText="new text" onDraftChange={vi.fn()} onCreate={vi.fn()} onReset={onReset} />);
    await user.click(screen.getByRole('button', { name: 'Edit source' }));
    await user.click(screen.getByRole('button', { name: 'Apply source text' }));
    expect(screen.getByRole('alert')).toHaveTextContent('delete the existing diagram elements');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onReset).not.toHaveBeenCalled();
  });
});
