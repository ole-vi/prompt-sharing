// ===== Subtask Manager Module =====
// Handles breaking down long prompts into logical subtasks

/**
 * Parse task-stub blocks from markdown
 * Format: :::task-stub{title="..."}...:::
 */
export function extractTaskStubs(text) {
  const taskStubRegex = /:::task-stub\{title="([^"]+)"\}\s*([\s\S]*?):::/g;
  const stubs = [];
  let match;

  while ((match = taskStubRegex.exec(text)) !== null) {
    stubs.push({
      title: match[1],
      content: match[2].trim()
    });
  }

  return stubs;
}

/**
 * Break prompt into paragraphs (sections separated by blank lines or headings)
 */
export function breakIntoParagraphs(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentSection = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = line.startsWith('#');
    const isBlank = line.trim() === '';

    // Start new section on headings or substantial blank lines
    if ((isHeading || isBlank) && currentSection.length > 0) {
      const sectionText = currentSection.join('\n').trim();
      if (sectionText.length > 50) { // Only include substantial sections
        sections.push({ content: sectionText });
      }
      currentSection = [];
      if (isHeading) {
        currentSection.push(line);
      }
    } else {
      currentSection.push(line);
    }
  }

  // Add final section
  if (currentSection.length > 0) {
    const sectionText = currentSection.join('\n').trim();
    if (sectionText.length > 50) {
      sections.push({ content: sectionText });
    }
  }

  return sections;
}

/**
 * Auto-detect best subtask strategy based on content
 */
export function analyzePromptStructure(text) {
  const taskStubs = extractTaskStubs(text);

  if (taskStubs.length > 1) {
    return {
      strategy: 'task-stubs',
      subtasks: taskStubs.map((stub, idx) => ({
        id: idx + 1,
        title: stub.title,
        content: stub.content,
        type: 'task-stub'
      })),
      recommendation: `Detected ${taskStubs.length} task blocks. These are ideal for sequential submission.`
    };
  }

  const paragraphs = breakIntoParagraphs(text);
  if (paragraphs.length > 3) {
    return {
      strategy: 'paragraph-based',
      subtasks: paragraphs.map((para, idx) => ({
        id: idx + 1,
        title: `Part ${idx + 1}`,
        content: para.content,
        type: 'paragraph'
      })),
      recommendation: `Detected ${paragraphs.length} logical sections. You can merge/split as needed.`
    };
  }

  return {
    strategy: 'none',
    subtasks: [],
    recommendation: 'Prompt is relatively short or unstructured. Consider sending as-is or manual splitting.'
  };
}

/**
 * Build subtasks with full context
 */
export function buildSubtaskSequence(fullPrompt, selectedSubtasks) {
  return selectedSubtasks.map((subtask, idx) => {
    const context =
      selectedSubtasks.length > 1
        ? `[Part ${idx + 1} of ${selectedSubtasks.length}]\n\n`
        : '';

    const header =
      subtask.title && subtask.title !== `Part ${idx + 1}`
        ? `**Task:** ${subtask.title}\n\n`
        : '';

    return {
      ...subtask,
      fullContent: context + header + subtask.content,
      sequenceInfo: {
        current: idx + 1,
        total: selectedSubtasks.length
      }
    };
  });
}

/**
 * Generate a summary of the split strategy
 */
export function generateSplitSummary(subtasks) {
  const summary = {
    totalSubtasks: subtasks.length,
    estimatedMinutes: Math.ceil(subtasks.length * 5), // Rough estimate: 5 min per subtask
    breakdown: subtasks.map((st, idx) => ({
      number: idx + 1,
      title: st.title || `Part ${idx + 1}`,
      contentLength: st.content.length,
      lines: st.content.split('\n').length
    }))
  };
  return summary;
}

/**
 * Validate subtask configuration
 */
export function validateSubtasks(subtasks) {
  const errors = [];
  const warnings = [];

  if (subtasks.length === 0) {
    errors.push('No subtasks selected');
  }

  if (subtasks.length > 20) {
    warnings.push('Many subtasks (20+) may take a long time to process');
  }

  subtasks.forEach((st, idx) => {
    if (!st.content || st.content.trim().length === 0) {
      errors.push(`Subtask ${idx + 1} is empty`);
    }
    if (st.content.length > 10000) {
      warnings.push(`Subtask ${idx + 1} is very large (${st.content.length} chars)`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
