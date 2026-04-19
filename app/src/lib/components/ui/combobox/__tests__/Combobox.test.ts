import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import Combobox from '../Combobox.svelte';
import type { ComboboxOption } from '../Combobox.svelte';

const sampleOptions: ComboboxOption[] = [
  { id: 'rephrase', label: 'Rephrase', description: 'Reword intent', group: 'Mutators' },
  { id: 'obfuscate', label: 'Obfuscate', description: 'Indirect meaning', group: 'Mutators' },
  { id: 'layered_mutation', label: 'Layered mutation', description: 'Chain mutators', group: 'Composites' }
];

describe('Combobox', () => {
  it('renders the trigger showing the selected option label', () => {
    const { getByRole } = render(Combobox, {
      value: 'rephrase',
      options: sampleOptions,
      onChange: () => {}
    });
    const trigger = getByRole('button');
    expect(trigger.textContent).toContain('Rephrase');
  });

  it('filters options when the user types into the search input', async () => {
    const { getByRole, getByPlaceholderText } = render(Combobox, {
      value: 'obfuscate',  // pick an option NOT in the filtered result to avoid trigger collision
      options: sampleOptions,
      placeholder: 'Search techniques',
      onChange: () => {}
    });

    // Open the popover
    await fireEvent.click(getByRole('button'));
    await tick();

    const input = getByPlaceholderText('Search techniques') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'layered' } });
    await tick();

    // The listbox should now only contain entries matching "layered" —
    // scope queries to the listbox element to exclude the trigger's own label.
    const listbox = getByRole('listbox');
    expect(listbox.textContent).toContain('Layered mutation');
    expect(listbox.textContent).not.toContain('Rephrase');
  });

  it('calls onChange with option id when a result is clicked', async () => {
    const onChange = vi.fn();
    const { getByRole, getByText } = render(Combobox, {
      value: 'rephrase',
      options: sampleOptions,
      onChange
    });

    await fireEvent.click(getByRole('button'));
    await tick();

    const item = getByText('Obfuscate');
    await fireEvent.click(item);
    await tick();

    expect(onChange).toHaveBeenCalledWith('obfuscate');
  });
});
