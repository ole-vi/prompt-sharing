/**
 * Parse task-stub blocks: :::task-stub{title="..."}...:::
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
 * Break prompt into paragraphs by blank lines and headings
 */
export function breakIntoParagraphs(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentSection = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = line.startsWith('#');
    const isBlank = line.trim() === '';

    if ((isHeading || isBlank) && currentSection.length > 0) {
      const sectionText = currentSection.join('\n').trim();
      if (sectionText.length > 50) {
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
 * Add sequence headers and context to each subtask
 */
export function buildSubtaskSequence(fullPrompt, selectedSubtasks) {
  return selectedSubtasks.map((subtask, idx) => {
    const header =
      subtask.title && subtask.title !== `Part ${idx + 1}`
        ? `**Task:** ${subtask.title}\n\n`
        : '';

    const julesContent = header + subtask.content;

    return {
      ...subtask,
      fullContent: julesContent,
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
    estimatedMinutes: Math.ceil(subtasks.length * 5),
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
 * Check for validation errors and warnings
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
