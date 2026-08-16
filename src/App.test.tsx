import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  it('renders the application shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /drag & drop diagram/i })).toBeInTheDocument();
  });

  it('keeps the source-text creation workflow and opens an empty SVG canvas', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent('Create a diagram');
    await user.type(screen.getByLabelText('Source text input'), 'слово Ἐν בְּרֵאשִׁית');
    await user.click(screen.getByRole('button', { name: 'Create diagram' }));

    expect(screen.getByRole('img', { name: 'Diagram SVG workspace' })).toBeInTheDocument();
    expect(screen.getByText(/3 total/)).toBeInTheDocument();
  });
});
