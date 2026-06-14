/* ==========================================================================
   AuraTask Core Logic & State Management
   ========================================================================== */

// 1. Initial State Definition
const INITIAL_CATEGORIES = [
  { id: 'work', name: 'Work', color: '#a855f7', icon: 'briefcase' },
  { id: 'personal', name: 'Personal', color: '#3b82f6', icon: 'user' },
  { id: 'fitness', name: 'Fitness', color: '#10b981', icon: 'dumbbell' },
  { id: 'shopping', name: 'Shopping', color: '#f59e0b', icon: 'shopping-cart' }
];

const state = {
  tasks: JSON.parse(localStorage.getItem('auratask_tasks')) || [],
  categories: JSON.parse(localStorage.getItem('auratask_categories')) || INITIAL_CATEGORIES,
  selectedCategory: 'all',
  activeFilter: 'all', // 'all', 'active', 'completed'
  searchQuery: '',
  sortBy: 'dueDate', // 'dueDate', 'priority', 'creation', 'alphabetical'
  currentView: 'dashboard', // 'dashboard', 'focus'
  theme: localStorage.getItem('auratask_theme') || 'dark',
  
  // Pomodoro Focus state
  timer: {
    running: false,
    mode: 'focus', // 'focus', 'break'
    timeLeft: 25 * 60,
    duration: parseInt(localStorage.getItem('auratask_timer_duration')) || 25,
    breakDuration: parseInt(localStorage.getItem('auratask_break_duration')) || 5,
    activeTaskId: null,
    sessionsFinished: parseInt(localStorage.getItem('auratask_sessions_finished')) || 0,
    totalFocusTime: parseInt(localStorage.getItem('auratask_total_focus_time')) || 0,
    intervalId: null
  },
  
  // Temporary state for the modal editor
  editingTaskId: null,
  editingSubtasks: []
};

// 2. DOM Caching
const DOM = {
  body: document.body,
  
  // Navigation
  viewAllBtn: document.getElementById('view-all-btn'),
  viewFocusBtn: document.getElementById('view-focus-btn'),
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  themeText: document.getElementById('theme-text'),
  currentViewTitle: document.getElementById('current-view-title'),
  quickStatusDate: document.getElementById('quick-status-date'),
  
  // Category List
  categoryList: document.getElementById('category-list'),
  addCategoryBtn: document.getElementById('add-category-btn'),
  addCategoryDialog: document.getElementById('add-category-dialog'),
  addCategoryForm: document.getElementById('add-category-form'),
  cancelCategoryBtn: document.getElementById('cancel-category-btn'),
  closeCategoryDialogBtn: document.getElementById('close-category-dialog-btn'),
  categoryNameInput: document.getElementById('category-name-input'),
  categoryIconSelect: document.getElementById('category-icon-select'),
  
  // Task Inputs
  newTaskForm: document.getElementById('new-task-form'),
  taskTitleInput: document.getElementById('task-title-input'),
  taskCategorySelect: document.getElementById('task-category-select'),
  taskPrioritySelect: document.getElementById('task-priority-select'),
  taskDueDate: document.getElementById('task-due-date'),
  
  // Filters & Headers
  taskSearchInput: document.getElementById('task-search-input'),
  filterAllBtn: document.getElementById('filter-all-btn'),
  filterActiveBtn: document.getElementById('filter-active-btn'),
  filterCompletedBtn: document.getElementById('filter-completed-btn'),
  sortSelect: document.getElementById('sort-select'),
  
  // Task Lists Containers
  taskListContainer: document.getElementById('task-list-container'),
  emptyState: document.getElementById('empty-state'),
  
  // Analytics
  statCompletionPct: document.getElementById('stat-completion-pct'),
  statRatioText: document.getElementById('stat-ratio-text'),
  statProgressCircle: document.getElementById('stat-progress-circle'),
  statUpcomingCount: document.getElementById('stat-upcoming-count'),
  statFocusTime: document.getElementById('stat-focus-time'),
  statFocusSessions: document.getElementById('stat-focus-sessions'),
  
  // Widget Timer
  widgetTimerDisplay: document.getElementById('widget-timer-display'),
  timerModeTag: document.getElementById('timer-mode-tag'),
  timerStartPauseBtn: document.getElementById('timer-start-pause-btn'),
  playPauseIcon: document.getElementById('play-pause-icon'),
  timerResetBtn: document.getElementById('timer-reset-btn'),
  focusTaskName: document.getElementById('focus-task-name'),
  activeFocusTaskContainer: document.getElementById('active-focus-task-container'),
  
  // Focus View Elements
  dashboardView: document.getElementById('dashboard-view'),
  focusView: document.getElementById('focus-view'),
  focusTimerDisplayMain: document.getElementById('focus-timer-display-main'),
  focusTimerLabelMain: document.getElementById('focus-timer-label-main'),
  focusTimerTaskMain: document.getElementById('focus-timer-task-main'),
  focusStartBtn: document.getElementById('focus-start-btn'),
  focusSkipBtn: document.getElementById('focus-skip-btn'),
  focusResetBtn: document.getElementById('focus-reset-btn'),
  focusDurationInput: document.getElementById('focus-duration'),
  breakDurationInput: document.getElementById('break-duration'),
  focusTasksGrid: document.getElementById('focus-tasks-grid'),
  
  // Edit & Subtask Modal Elements
  editTaskDialog: document.getElementById('edit-task-dialog'),
  editTaskTitle: document.getElementById('edit-task-title'),
  editTaskCategory: document.getElementById('edit-task-category'),
  editTaskPriority: document.getElementById('edit-task-priority'),
  editTaskDueDate: document.getElementById('edit-task-due-date'),
  newSubtaskTitle: document.getElementById('new-subtask-title'),
  addSubtaskActionBtn: document.getElementById('add-subtask-action-btn'),
  subtaskListEditContainer: document.getElementById('subtask-list-edit-container'),
  saveTaskBtn: document.getElementById('save-task-btn'),
  cancelEditBtn: document.getElementById('cancel-edit-btn'),
  closeEditDialogBtn: document.getElementById('close-edit-dialog-btn')
};

// 3. System Sounds (Synthesized via Web Audio API)
function playSystemAlert(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'focus_complete') {
      // High double beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, audioCtx.currentTime); // E5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.45);
    } else if (type === 'break_complete') {
      // Soothing rising bell
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc.frequency.setValueAtTime(554, audioCtx.currentTime + 0.1); // C#5
      osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.2); // E5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.55);
    } else if (type === 'click') {
      // Soft click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.06);
    }
  } catch (e) {
    console.warn("Audio Context playback warning (requires interaction):", e);
  }
}

// 4. Utility Functions
function saveState() {
  localStorage.setItem('auratask_tasks', JSON.stringify(state.tasks));
  localStorage.setItem('auratask_categories', JSON.stringify(state.categories));
  localStorage.setItem('auratask_theme', state.theme);
  localStorage.setItem('auratask_timer_duration', state.timer.duration);
  localStorage.setItem('auratask_break_duration', state.timer.breakDuration);
  localStorage.setItem('auratask_sessions_finished', state.timer.sessionsFinished);
  localStorage.setItem('auratask_total_focus_time', state.timer.totalFocusTime);
}

function formatDateRelative(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return { text: 'Today', class: 'today' };
  if (diffDays === 1) return { text: 'Tomorrow', class: 'tomorrow' };
  if (diffDays === -1) return { text: 'Yesterday (Overdue)', class: 'overdue' };
  if (diffDays < 0) return { text: `Overdue (${Math.abs(diffDays)}d ago)`, class: 'overdue' };
  if (diffDays <= 7) return { text: `${diffDays}d left`, class: 'upcoming' };
  
  const options = { month: 'short', day: 'numeric' };
  return { text: due.toLocaleDateString('en-US', options), class: 'future' };
}

// Helper to determine active task object
function getActiveTask() {
  return state.tasks.find(t => t.id === state.timer.activeTaskId);
}

// 5. Core Rendering Functions
function renderCategories() {
  // Clear lists
  DOM.categoryList.innerHTML = '';
  DOM.taskCategorySelect.innerHTML = '';
  DOM.editTaskCategory.innerHTML = '';
  
  // Render sidebar category navigation
  const allActive = state.selectedCategory === 'all' ? 'active' : '';
  const allCount = state.tasks.length;
  DOM.categoryList.innerHTML += `
    <li>
      <button class="nav-btn ${allActive}" data-category-filter="all">
        <i data-lucide="folder-open"></i>
        <span>All Categories</span>
        <span class="category-count">${allCount}</span>
      </button>
    </li>
  `;
  
  state.categories.forEach(cat => {
    const active = state.selectedCategory === cat.id ? 'active' : '';
    const taskCount = state.tasks.filter(t => t.category === cat.id).length;
    DOM.categoryList.innerHTML += `
      <li>
        <button class="nav-btn ${active}" data-category-filter="${cat.id}">
          <span class="category-indicator" style="background-color: ${cat.color};"></span>
          <i data-lucide="${cat.icon}"></i>
          <span>${cat.name}</span>
          <span class="category-count">${taskCount}</span>
        </button>
      </li>
    `;
    
    // Populate dropdown selectors
    const option = `<option value="${cat.id}">${cat.name}</option>`;
    DOM.taskCategorySelect.innerHTML += option;
    DOM.editTaskCategory.innerHTML += option;
  });
  
  // Bind category clicks
  document.querySelectorAll('[data-category-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      playSystemAlert('click');
      const catFilter = e.currentTarget.getAttribute('data-category-filter');
      state.selectedCategory = catFilter;
      
      // If we are in focus view, redirect back to Dashboard to let them see filtered results
      if (state.currentView !== 'dashboard') {
        switchView('dashboard');
      }
      
      render();
    });
  });
}

function renderAnalytics() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Circle percentage math
  const circumference = 213.63; // 2 * PI * r(34)
  const offset = circumference - (completionRate / 100) * circumference;
  
  DOM.statCompletionPct.textContent = `${completionRate}%`;
  DOM.statRatioText.textContent = `${completed} of ${total} completed`;
  DOM.statProgressCircle.style.strokeDashoffset = offset;
  
  // Upcoming deadline count (due within 48 hours)
  const today = new Date();
  const limit = new Date();
  limit.setDate(today.getDate() + 2);
  const upcomingCount = state.tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= today && due <= limit;
  }).length;
  DOM.statUpcomingCount.textContent = upcomingCount;
  
  // Focus metrics
  const totalHours = Math.floor(state.timer.totalFocusTime / 60);
  const totalMinutes = state.timer.totalFocusTime % 60;
  DOM.statFocusTime.textContent = `${totalHours}h ${totalMinutes}m`;
  DOM.statFocusSessions.textContent = `${state.timer.sessionsFinished} sessions finished`;
}

function renderTasks() {
  // Get filtered and sorted list
  let filtered = state.tasks.filter(task => {
    // Category match
    if (state.selectedCategory !== 'all' && task.category !== state.selectedCategory) {
      return false;
    }
    // Search query match
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const categoryName = state.categories.find(c => c.id === task.category)?.name.toLowerCase() || '';
      const matchCat = categoryName.includes(q);
      if (!matchTitle && !matchCat) return false;
    }
    // Filter active/completed
    if (state.activeFilter === 'active' && task.completed) return false;
    if (state.activeFilter === 'completed' && !task.completed) return false;
    
    return true;
  });
  
  // Sort
  filtered = sortTasks(filtered);
  
  DOM.taskListContainer.innerHTML = '';
  
  if (filtered.length === 0) {
    DOM.emptyState.style.display = 'flex';
  } else {
    DOM.emptyState.style.display = 'none';
    
    filtered.forEach(task => {
      const categoryObj = state.categories.find(c => c.id === task.category);
      const isCompletedClass = task.completed ? 'completed' : '';
      const relativeDate = formatDateRelative(task.dueDate);
      
      // Compute subtask breakdown
      const totalSubs = task.subtasks ? task.subtasks.length : 0;
      const completedSubs = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
      const hasSubtasks = totalSubs > 0;
      
      const subtaskCollapseState = task.isExpanded ? '' : 'hidden';
      const chevronClass = task.isExpanded ? 'expanded' : '';
      
      let dateBadgeHtml = '';
      if (relativeDate) {
        let dateIcon = 'calendar';
        if (relativeDate.class === 'overdue') dateIcon = 'alert-triangle';
        else if (relativeDate.class === 'today') dateIcon = 'clock';
        
        dateBadgeHtml = `
          <div class="due-date-badge ${relativeDate.class}">
            <i data-lucide="${dateIcon}"></i>
            <span>${relativeDate.text}</span>
          </div>
        `;
      }
      
      let subtasksIndicatorHtml = '';
      if (hasSubtasks) {
        subtasksIndicatorHtml = `
          <div class="subtasks-compact-indicator ${chevronClass}" data-toggle-subtasks="${task.id}">
            <i data-lucide="chevron-down"></i>
            <span>Checklist (${completedSubs}/${totalSubs})</span>
          </div>
        `;
      }
      
      // Construct main task card HTML
      const itemHTML = `
        <div class="task-item ${isCompletedClass}" data-id="${task.id}">
          <div class="task-item-main">
            <!-- Stylized Checkbox -->
            <label class="task-checkbox-container" aria-label="Toggle Complete">
              <input type="checkbox" ${task.completed ? 'checked' : ''} data-toggle-id="${task.id}">
              <span class="checkmark"></span>
            </label>
            
            <div class="task-details">
              <p class="task-text">${escapeHTML(task.title)}</p>
              <div class="task-meta">
                <span class="badge priority-badge ${task.priority}">
                  <i data-lucide="flag"></i>${task.priority}
                </span>
                
                ${categoryObj ? `
                  <span class="badge category-badge">
                    <span class="category-indicator" style="background-color: ${categoryObj.color}; margin-right: 4px;"></span>
                    ${categoryObj.name}
                  </span>
                ` : ''}
                
                ${dateBadgeHtml}
                
                ${task.focusTimeSpent > 0 ? `
                  <span class="due-date-badge">
                    <i data-lucide="hourglass"></i>
                    <span>Focused: ${Math.round(task.focusTimeSpent / 60)}m</span>
                  </span>
                ` : ''}
              </div>
              
              ${subtasksIndicatorHtml}
            </div>

            <div class="task-actions">
              <!-- Pomodoro Focus Mode button -->
              <button class="action-btn focus" data-focus-id="${task.id}" title="Focus on this task">
                <i data-lucide="target"></i>
              </button>
              <!-- Edit Details button -->
              <button class="action-btn" data-edit-id="${task.id}" title="Edit/Add sub-tasks">
                <i data-lucide="edit-3"></i>
              </button>
              <!-- Delete task button -->
              <button class="action-btn delete" data-delete-id="${task.id}" title="Delete task">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
          
          <!-- Expanded Checklist Section -->
          ${hasSubtasks ? `
            <div class="subtask-list-expanded ${subtaskCollapseState}" id="expanded-subs-${task.id}">
              ${task.subtasks.map(sub => `
                <div class="subtask-item-row">
                  <input type="checkbox" class="subtask-checkbox" 
                    ${sub.completed ? 'checked' : ''} 
                    data-parent-id="${task.id}" 
                    data-sub-id="${sub.id}">
                  <span class="subtask-text ${sub.completed ? 'completed' : ''}">${escapeHTML(sub.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
      
      DOM.taskListContainer.innerHTML += itemHTML;
    });
  }
  
  // Re-initialize dynamic Lucide SVGs
  lucide.createIcons();
  
  // Re-bind dynamically rendered elements
  bindTaskEvents();
}

function sortTasks(taskList) {
  return [...taskList].sort((a, b) => {
    // If complete, push to bottom (optional, but clean. Let's keep filters separate)
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    
    if (state.sortBy === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (state.sortBy === 'priority') {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (state.sortBy === 'creation') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (state.sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });
}

function renderFocusView() {
  DOM.focusTasksGrid.innerHTML = '';
  
  // Show active tasks only for focus
  const activeTasks = state.tasks.filter(t => !t.completed);
  
  if (activeTasks.length === 0) {
    DOM.focusTasksGrid.innerHTML = `
      <p class="focus-label" style="text-align: center; padding: 20px;">No active tasks available to focus on. Add some in Dashboard!</p>
    `;
    return;
  }
  
  activeTasks.forEach(task => {
    const isActive = state.timer.activeTaskId === task.id ? 'active' : '';
    const categoryObj = state.categories.find(c => c.id === task.category);
    
    DOM.focusTasksGrid.innerHTML += `
      <div class="focus-task-item ${isActive}" data-select-focus-id="${task.id}">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${categoryObj ? `<span class="category-indicator" style="background-color: ${categoryObj.color}"></span>` : ''}
          <span style="font-weight: 500;">${escapeHTML(task.title)}</span>
        </div>
        <span class="badge priority-badge ${task.priority}">${task.priority}</span>
      </div>
    `;
  });
  
  // Bind focus task select clicks
  document.querySelectorAll('[data-select-focus-id]').forEach(item => {
    item.addEventListener('click', (e) => {
      playSystemAlert('click');
      const taskId = e.currentTarget.getAttribute('data-select-focus-id');
      selectFocusTask(taskId);
    });
  });
}

function renderTimer() {
  const minutes = Math.floor(state.timer.timeLeft / 60);
  const seconds = state.timer.timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Update Widget & Focus Page
  DOM.widgetTimerDisplay.textContent = formattedTime;
  DOM.focusTimerDisplayMain.textContent = formattedTime;
  
  // Update Mode Tags
  const modeText = state.timer.mode === 'focus' ? 'Focus' : 'Break';
  DOM.timerModeTag.textContent = modeText;
  DOM.focusTimerLabelMain.textContent = `${modeText} Session`;
  
  if (state.timer.mode === 'focus') {
    DOM.timerModeTag.classList.remove('break-mode');
  } else {
    DOM.timerModeTag.classList.add('break-mode');
  }
  
  // Start/Pause Button state
  const iconName = state.timer.running ? 'pause' : 'play';
  DOM.playPauseIcon.setAttribute('data-lucide', iconName);
  
  if (state.timer.running) {
    DOM.focusStartBtn.innerHTML = `<i data-lucide="pause"></i> Pause Session`;
    DOM.focusStartBtn.classList.add('active');
  } else {
    DOM.focusStartBtn.innerHTML = `<i data-lucide="play"></i> Start Focusing`;
    DOM.focusStartBtn.classList.remove('active');
  }
  
  // Update Active Task names
  const activeTask = getActiveTask();
  if (activeTask) {
    DOM.focusTaskName.textContent = activeTask.title;
    DOM.focusTimerTaskMain.textContent = activeTask.title;
    DOM.activeFocusTaskContainer.style.display = 'block';
  } else {
    DOM.focusTaskName.textContent = 'No active task';
    DOM.focusTimerTaskMain.textContent = 'Select a task to start focusing';
    DOM.activeFocusTaskContainer.style.display = 'none';
  }
  
  lucide.createIcons();
}

function render() {
  renderCategories();
  renderAnalytics();
  renderTasks();
  renderFocusView();
  renderTimer();
}

// 6. Action Bindings
function bindTaskEvents() {
  // Checkbox toggle
  document.querySelectorAll('[data-toggle-id]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const taskId = e.target.getAttribute('data-toggle-id');
      toggleTaskComplete(taskId);
    });
  });
  
  // Focus trigger
  document.querySelectorAll('[data-focus-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-focus-id');
      selectFocusTask(taskId);
      switchView('focus');
    });
  });
  
  // Edit detail trigger
  document.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-edit-id');
      openEditModal(taskId);
    });
  });
  
  // Delete trigger
  document.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-delete-id');
      deleteTask(taskId);
    });
  });
  
  // Subtasks display toggle
  document.querySelectorAll('[data-toggle-subtasks]').forEach(indicator => {
    indicator.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-toggle-subtasks');
      toggleSubtasksListDisplay(taskId);
    });
  });
  
  // Subtask checkbox click
  document.querySelectorAll('.subtask-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const parentId = e.target.getAttribute('data-parent-id');
      const subId = e.target.getAttribute('data-sub-id');
      toggleSubtaskComplete(parentId, subId);
    });
  });
}

// 7. Core Action Handlers
function toggleTaskComplete(id) {
  playSystemAlert('click');
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    
    // Complete all subtasks if task completed
    if (task.completed && task.subtasks) {
      task.subtasks.forEach(s => s.completed = true);
    }
    
    // If active focus task completed, reset focus timer details
    if (task.completed && state.timer.activeTaskId === id) {
      state.timer.activeTaskId = null;
    }
    
    saveState();
    render();
  }
}

function deleteTask(id) {
  playSystemAlert('click');
  state.tasks = state.tasks.filter(t => t.id !== id);
  
  if (state.timer.activeTaskId === id) {
    state.timer.activeTaskId = null;
  }
  
  saveState();
  render();
}

function toggleSubtasksListDisplay(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.isExpanded = !task.isExpanded;
    saveState();
    render();
  }
}

function toggleSubtaskComplete(parentId, subId) {
  playSystemAlert('click');
  const task = state.tasks.find(t => t.id === parentId);
  if (task && task.subtasks) {
    const sub = task.subtasks.find(s => s.id === subId);
    if (sub) {
      sub.completed = !sub.completed;
      
      // Auto-toggle main task completed status if subtasks are all completed?
      // Premium feature: check if all are completed, but don't force complete unless user wants it
      // Let's keep them independent for flexibility but recalculate metrics
      saveState();
      render();
    }
  }
}

function addNewTask(title, category, priority, dueDate) {
  const newTask = {
    id: Date.now().toString(),
    title: title.trim(),
    category,
    priority,
    dueDate: dueDate || null,
    completed: false,
    subtasks: [],
    createdAt: new Date().toISOString(),
    focusTimeSpent: 0,
    isExpanded: false
  };
  
  state.tasks.push(newTask);
  saveState();
  render();
}

function selectFocusTask(taskId) {
  state.timer.activeTaskId = taskId;
  
  // If timer is NOT running, set it to the default focus duration
  if (!state.timer.running && state.timer.mode === 'focus') {
    state.timer.timeLeft = state.timer.duration * 60;
  }
  
  saveState();
  render();
}

// 8. Focus / Pomodoro Timer Handlers
function toggleTimer() {
  playSystemAlert('click');
  if (state.timer.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (state.timer.running) return;
  
  state.timer.running = true;
  state.timer.intervalId = setInterval(tickTimer, 1000);
  
  renderTimer();
}

function pauseTimer() {
  if (!state.timer.running) return;
  
  state.timer.running = false;
  clearInterval(state.timer.intervalId);
  state.timer.intervalId = null;
  
  renderTimer();
}

function resetTimer() {
  playSystemAlert('click');
  pauseTimer();
  
  if (state.timer.mode === 'focus') {
    state.timer.timeLeft = state.timer.duration * 60;
  } else {
    state.timer.timeLeft = state.timer.breakDuration * 60;
  }
  
  renderTimer();
}

function tickTimer() {
  if (state.timer.timeLeft > 0) {
    state.timer.timeLeft--;
    
    // Accumulate focus time if focusing on active task
    if (state.timer.mode === 'focus') {
      state.timer.totalFocusTime += 1 / 60; // accumulation in fractions of minutes
      
      const activeTask = getActiveTask();
      if (activeTask) {
        activeTask.focusTimeSpent += 1; // accumulated in seconds
      }
    }
    
    renderTimer();
  } else {
    // Session Done!
    handleTimerCompletion();
  }
}

function handleTimerCompletion() {
  pauseTimer();
  
  if (state.timer.mode === 'focus') {
    // Focus finished
    state.timer.sessionsFinished++;
    state.timer.mode = 'break';
    state.timer.timeLeft = state.timer.breakDuration * 60;
    playSystemAlert('focus_complete');
    
    // Auto-save state updates
    saveState();
    renderAnalytics();
    
    // Show visual notice
    showBrowserNotification("Focus Session Completed!", "Time for a well-deserved short break!");
  } else {
    // Break finished
    state.timer.mode = 'focus';
    state.timer.timeLeft = state.timer.duration * 60;
    playSystemAlert('break_complete');
    
    // Show visual notice
    showBrowserNotification("Break Finished!", "Ready to focus on your quest again?");
  }
  
  saveState();
  render();
}

function showBrowserNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: 'assets/logo.png' });
  } else {
    // Fallback: visual status update alert
    const floatAlert = document.createElement('div');
    floatAlert.style.position = 'fixed';
    floatAlert.style.bottom = '20px';
    floatAlert.style.right = '20px';
    floatAlert.style.background = 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))';
    floatAlert.style.color = 'white';
    floatAlert.style.padding = '16px 24px';
    floatAlert.style.borderRadius = '12px';
    floatAlert.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    floatAlert.style.zIndex = '1000';
    floatAlert.style.fontFamily = 'var(--font-sans)';
    floatAlert.style.fontSize = '14px';
    floatAlert.style.fontWeight = '600';
    floatAlert.style.transition = 'all 0.5s ease';
    floatAlert.innerHTML = `<h4 style="margin:0 0 4px;font-size:15px;">${title}</h4><p style="margin:0;font-size:12px;opacity:0.9;">${body}</p>`;
    
    document.body.appendChild(floatAlert);
    setTimeout(() => {
      floatAlert.style.opacity = '0';
      floatAlert.style.transform = 'translateY(10px)';
      setTimeout(() => floatAlert.remove(), 500);
    }, 4000);
  }
}

// Skip Timer mode
function skipTimerSession() {
  playSystemAlert('click');
  pauseTimer();
  if (state.timer.mode === 'focus') {
    state.timer.mode = 'break';
    state.timer.timeLeft = state.timer.breakDuration * 60;
  } else {
    state.timer.mode = 'focus';
    state.timer.timeLeft = state.timer.duration * 60;
  }
  render();
}

// 9. Edit Details Dialog
function openEditModal(taskId) {
  playSystemAlert('click');
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  state.editingTaskId = taskId;
  state.editingSubtasks = task.subtasks ? [...task.subtasks] : [];
  
  DOM.editTaskTitle.value = task.title;
  DOM.editTaskCategory.value = task.category;
  DOM.editTaskPriority.value = task.priority;
  DOM.editTaskDueDate.value = task.dueDate || '';
  
  renderEditModalSubtasks();
  DOM.editTaskDialog.showModal();
}

function renderEditModalSubtasks() {
  DOM.subtaskListEditContainer.innerHTML = '';
  
  if (state.editingSubtasks.length === 0) {
    DOM.subtaskListEditContainer.innerHTML = `
      <p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No sub-tasks. Add checklist steps below.</p>
    `;
    return;
  }
  
  state.editingSubtasks.forEach(sub => {
    DOM.subtaskListEditContainer.innerHTML += `
      <div class="subtask-edit-item">
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" class="subtask-edit-checkbox" ${sub.completed ? 'checked' : ''} data-edit-sub-id="${sub.id}">
          <span style="font-size:13px; color: ${sub.completed ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${sub.completed ? 'line-through' : 'none'};">${escapeHTML(sub.title)}</span>
        </div>
        <button class="action-btn delete" data-remove-sub-id="${sub.id}" style="width:24px; height:24px;">
          <i data-lucide="x" style="width:14px; height:14px;"></i>
        </button>
      </div>
    `;
  });
  
  // Re-bind modal subtask events
  lucide.createIcons();
  
  document.querySelectorAll('[data-edit-sub-id]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const subId = e.target.getAttribute('data-edit-sub-id');
      const sub = state.editingSubtasks.find(s => s.id === subId);
      if (sub) {
        sub.completed = e.target.checked;
        renderEditModalSubtasks();
      }
    });
  });
  
  document.querySelectorAll('[data-remove-sub-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const subId = e.currentTarget.getAttribute('data-remove-sub-id');
      state.editingSubtasks = state.editingSubtasks.filter(s => s.id !== subId);
      renderEditModalSubtasks();
    });
  });
}

function addNewSubtaskToEditingList() {
  const title = DOM.newSubtaskTitle.value.trim();
  if (!title) return;
  
  const newSub = {
    id: Date.now().toString(),
    title,
    completed: false
  };
  
  state.editingSubtasks.push(newSub);
  DOM.newSubtaskTitle.value = '';
  renderEditModalSubtasks();
}

function saveTaskDetails() {
  const task = state.tasks.find(t => t.id === state.editingTaskId);
  if (task) {
    task.title = DOM.editTaskTitle.value.trim();
    task.category = DOM.editTaskCategory.value;
    task.priority = DOM.editTaskPriority.value;
    task.dueDate = DOM.editTaskDueDate.value || null;
    task.subtasks = [...state.editingSubtasks];
    
    saveState();
    render();
  }
  DOM.editTaskDialog.close();
}

// 10. Navigation View Swapping
function switchView(viewName) {
  state.currentView = viewName;
  
  if (viewName === 'dashboard') {
    DOM.viewAllBtn.classList.add('active');
    DOM.viewFocusBtn.classList.remove('active');
    DOM.dashboardView.classList.remove('hidden');
    DOM.focusView.classList.add('hidden');
    DOM.currentViewTitle.textContent = "Active Tasks";
  } else if (viewName === 'focus') {
    DOM.viewAllBtn.classList.remove('active');
    DOM.viewFocusBtn.classList.add('active');
    DOM.dashboardView.classList.add('hidden');
    DOM.focusView.classList.remove('hidden');
    DOM.currentViewTitle.textContent = "Focus Engine";
    renderFocusView();
  }
}

// Theme management
function toggleTheme() {
  playSystemAlert('click');
  if (state.theme === 'dark') {
    state.theme = 'light';
    DOM.body.classList.remove('dark-theme');
    DOM.body.classList.add('light-theme');
    DOM.themeText.textContent = "Dark Mode";
  } else {
    state.theme = 'dark';
    DOM.body.classList.remove('light-theme');
    DOM.body.classList.add('dark-theme');
    DOM.themeText.textContent = "Light Mode";
  }
  saveState();
}

// Request Notification Permission
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// HTML Escaper for security
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// 11. Event Listeners Setup
function setupEventListeners() {
  // Mobile Sidebar Toggle
  DOM.sidebarToggle.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('mobile-open');
  });
  
  // Close mobile sidebar on layout click
  DOM.body.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        !DOM.sidebar.contains(e.target) && 
        !DOM.sidebarToggle.contains(e.target) && 
        DOM.sidebar.classList.contains('mobile-open')) {
      DOM.sidebar.classList.remove('mobile-open');
    }
  });

  // Switch views
  DOM.viewAllBtn.addEventListener('click', () => {
    playSystemAlert('click');
    switchView('dashboard');
  });
  DOM.viewFocusBtn.addEventListener('click', () => {
    playSystemAlert('click');
    switchView('focus');
  });
  
  // Theme Toggle
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);
  
  // New Task form submit
  DOM.newTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = DOM.taskTitleInput.value;
    const cat = DOM.taskCategorySelect.value;
    const prio = DOM.taskPrioritySelect.value;
    const due = DOM.taskDueDate.value;
    
    addNewTask(title, cat, prio, due);
    
    // Clear inputs
    DOM.taskTitleInput.value = '';
    DOM.taskDueDate.value = '';
    DOM.taskTitleInput.focus();
  });
  
  // Filters All/Active/Completed
  DOM.filterAllBtn.addEventListener('click', (e) => {
    playSystemAlert('click');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    DOM.filterAllBtn.classList.add('active');
    state.activeFilter = 'all';
    renderTasks();
  });
  
  DOM.filterActiveBtn.addEventListener('click', (e) => {
    playSystemAlert('click');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    DOM.filterActiveBtn.classList.add('active');
    state.activeFilter = 'active';
    renderTasks();
  });
  
  DOM.filterCompletedBtn.addEventListener('click', (e) => {
    playSystemAlert('click');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    DOM.filterCompletedBtn.classList.add('active');
    state.activeFilter = 'completed';
    renderTasks();
  });
  
  // Sort Select Change
  DOM.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderTasks();
  });
  
  // Search Keyup
  DOM.taskSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTasks();
  });

  // Category Add Modal
  DOM.addCategoryBtn.addEventListener('click', () => {
    playSystemAlert('click');
    DOM.addCategoryDialog.showModal();
  });
  
  DOM.closeCategoryDialogBtn.addEventListener('click', () => DOM.addCategoryDialog.close());
  DOM.cancelCategoryBtn.addEventListener('click', () => DOM.addCategoryDialog.close());
  
  DOM.addCategoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = DOM.categoryNameInput.value.trim();
    const color = document.querySelector('input[name="category-color"]:checked').value;
    const icon = DOM.categoryIconSelect.value;
    
    const newCat = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      color,
      icon
    };
    
    state.categories.push(newCat);
    saveState();
    DOM.addCategoryDialog.close();
    DOM.categoryNameInput.value = '';
    render();
  });

  // Edit Task Actions
  DOM.closeEditDialogBtn.addEventListener('click', () => DOM.editTaskDialog.close());
  DOM.cancelEditBtn.addEventListener('click', () => DOM.editTaskDialog.close());
  DOM.saveTaskBtn.addEventListener('click', saveTaskDetails);
  
  DOM.addSubtaskActionBtn.addEventListener('click', addNewSubtaskToEditingList);
  DOM.newSubtaskTitle.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewSubtaskToEditingList();
    }
  });

  // Pomodoro Controls (Sidebar & Main Sync)
  DOM.timerStartPauseBtn.addEventListener('click', toggleTimer);
  DOM.timerResetBtn.addEventListener('click', resetTimer);
  
  DOM.focusStartBtn.addEventListener('click', toggleTimer);
  DOM.focusResetBtn.addEventListener('click', resetTimer);
  DOM.focusSkipBtn.addEventListener('click', skipTimerSession);
  
  // Timer settings inputs
  DOM.focusDurationInput.addEventListener('change', (e) => {
    const min = Math.max(1, parseInt(e.target.value) || 25);
    state.timer.duration = min;
    saveState();
    if (!state.timer.running && state.timer.mode === 'focus') {
      state.timer.timeLeft = min * 60;
      renderTimer();
    }
  });
  
  DOM.breakDurationInput.addEventListener('change', (e) => {
    const min = Math.max(1, parseInt(e.target.value) || 5);
    state.timer.breakDuration = min;
    saveState();
    if (!state.timer.running && state.timer.mode === 'break') {
      state.timer.timeLeft = min * 60;
      renderTimer();
    }
  });
}

// 12. Application Bootstrapper
function init() {
  // Sync initial theme class on body
  DOM.body.className = `${state.theme}-theme`;
  DOM.themeText.textContent = state.theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  
  // Set default due-date constraints (min=today)
  const todayStr = new Date().toISOString().split('T')[0];
  DOM.taskDueDate.min = todayStr;
  DOM.editTaskDueDate.min = todayStr;
  
  // Current calendar day label
  const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  DOM.quickStatusDate.textContent = new Date().toLocaleDateString('en-US', dateOptions);
  
  // Set initial input focus configuration values
  DOM.focusDurationInput.value = state.timer.duration;
  DOM.breakDurationInput.value = state.timer.breakDuration;
  
  if (state.timer.mode === 'focus') {
    state.timer.timeLeft = state.timer.duration * 60;
  } else {
    state.timer.timeLeft = state.timer.breakDuration * 60;
  }

  setupEventListeners();
  requestNotificationPermission();
  render();
}

// Start AuraTask
document.addEventListener('DOMContentLoaded', init);
// Run init immediately if DOM ready
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  init();
}
