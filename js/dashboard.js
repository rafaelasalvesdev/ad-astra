// js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Set Dynamic Greeting
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greeting');
    if (hour < 12) greetingEl.textContent = "Good morning, writer.";
    else if (hour < 18) greetingEl.textContent = "Good afternoon, writer.";
    else greetingEl.textContent = "Good evening, writer.";

    // 2. Load Metadata (Todos) from Hard Drive
    let meta = await Storage.getMetadata();
    if (!meta.todos) meta.todos = []; // Failsafe if empty

    // 3. Render and Handle To-Do List
    const todoContainer = document.getElementById('todo-list');
    const todoInput = document.getElementById('new-todo');

    function renderTodos() {
        if (meta.todos.length === 0) {
            todoContainer.innerHTML = `<span class="mut">No pending tasks.</span>`;
            return;
        }

        todoContainer.innerHTML = meta.todos.map((task, index) => `
            <label class="todo-item">
                <input type="checkbox" ${task.done ? 'checked' : ''} data-index="${index}">
                <span style="text-decoration: ${task.done ? 'line-through' : 'none'}; opacity: ${task.done ? 0.6 : 1}">
                    ${task.text}
                </span>
            </label>
        `).join('');
    }

    // Toggle Checkbox Status
    todoContainer.addEventListener('change', async (e) => {
        if (e.target.tagName === 'INPUT') {
            const index = e.target.dataset.index;
            meta.todos[index].done = e.target.checked;
            await Storage.saveMetadata(meta); // Save to metadata.json
            renderTodos();
        }
    });

    // Add New Task
    todoInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && e.target.value.trim() !== '') {
            meta.todos.push({ text: e.target.value.trim(), done: false });
            await Storage.saveMetadata(meta); // Save to metadata.json
            e.target.value = '';
            renderTodos();
        }
    });

    renderTodos();

    // 4. Generate Aesthetic Git-Graph Mockup
    const gitGraph = document.getElementById('git-graph');
    let boxes = '';
    // Generate 70 days of boxes
    for(let i = 0; i < 70; i++) {
        const rand = Math.random();
        let level = '';
        if (rand > 0.9) level = 'level-3';
        else if (rand > 0.7) level = 'level-2';
        else if (rand > 0.5) level = 'level-1';
        
        boxes += `<div class="git-box ${level}"></div>`;
    }
    gitGraph.innerHTML = boxes;
});