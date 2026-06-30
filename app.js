const STORAGE_KEY = "healthy-project-records-v1";
const DEFAULT_CALORIE_SETTINGS = {
  sex: "male",
  height: 185,
  age: 23,
  dayType: "training",
  strengthCalories: 200,
  cardioCalories: 150,
  calorieDeficit: 1100,
};
const TASK_CATEGORIES = ["重要且紧急", "重要不紧急", "不重要但紧急", "不重要不紧急"];
const TASK_TIME_BLOCKS = ["上午", "中午", "下午", "晚上"];

const state = loadState();
let supabaseClient = null;
let cloudUser = null;
const editing = {
  weightId: null,
  foodId: null,
  exerciseId: null,
  favoriteFoodId: null,
  taskId: null,
  noteId: null,
};

const today = new Date();
const todayKey = toDateKey(today);
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

const elements = {
  tabs: document.querySelectorAll(".tab-button"),
  views: {
    dashboard: document.querySelector("#dashboardView"),
    records: document.querySelector("#recordsView"),
    history: document.querySelector("#historyView"),
  },
  todayDate: document.querySelector("#todayDate"),
  todayWeight: document.querySelector("#todayWeight"),
  todayCalories: document.querySelector("#todayCalories"),
  todayMinutes: document.querySelector("#todayMinutes"),
  latestWeight: document.querySelector("#latestWeight"),
  weightChange: document.querySelector("#weightChange"),
  calorieTotal: document.querySelector("#calorieTotal"),
  mealCount: document.querySelector("#mealCount"),
  minuteTotal: document.querySelector("#minuteTotal"),
  workoutCount: document.querySelector("#workoutCount"),
  taskProgress: document.querySelector("#taskProgress"),
  taskCount: document.querySelector("#taskCount"),
  maxCalories: document.querySelector("#maxCalories"),
  remainingCalories: document.querySelector("#remainingCalories"),
  calorieBasis: document.querySelector("#calorieBasis"),
  bmrValue: document.querySelector("#bmrValue"),
  balanceCalories: document.querySelector("#balanceCalories"),
  deficitValue: document.querySelector("#deficitValue"),
  macroCalories: document.querySelector("#macroCalories"),
  carbTotal: document.querySelector("#carbTotal"),
  proteinTotal: document.querySelector("#proteinTotal"),
  fatTotal: document.querySelector("#fatTotal"),
  carbBar: document.querySelector("#carbBar"),
  proteinBar: document.querySelector("#proteinBar"),
  fatBar: document.querySelector("#fatBar"),
  chart: document.querySelector("#weightChart"),
  chartRange: document.querySelector("#chartRange"),
  todayFoodList: document.querySelector("#todayFoodList"),
  todayExerciseList: document.querySelector("#todayExerciseList"),
  todayTaskList: document.querySelector("#todayTaskList"),
  todayNoteList: document.querySelector("#todayNoteList"),
  foodEmptyHint: document.querySelector("#foodEmptyHint"),
  exerciseEmptyHint: document.querySelector("#exerciseEmptyHint"),
  taskEmptyHint: document.querySelector("#taskEmptyHint"),
  noteEmptyHint: document.querySelector("#noteEmptyHint"),
  historyList: document.querySelector("#historyList"),
  emptyTemplate: document.querySelector("#emptyTemplate"),
  calorieTargetForm: document.querySelector("#calorieTargetForm"),
  weightForm: document.querySelector("#weightForm"),
  foodForm: document.querySelector("#foodForm"),
  favoriteFoodForm: document.querySelector("#favoriteFoodForm"),
  favoriteFoodSelect: document.querySelector("#favoriteFoodSelect"),
  favoriteFoodList: document.querySelector("#favoriteFoodList"),
  exerciseForm: document.querySelector("#exerciseForm"),
  taskForm: document.querySelector("#taskForm"),
  noteForm: document.querySelector("#noteForm"),
  clearButton: document.querySelector("#clearButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  cloudStatus: document.querySelector("#cloudStatus"),
  cloudAuthForm: document.querySelector("#cloudAuthForm"),
  cloudSignupButton: document.querySelector("#cloudSignupButton"),
  cloudUploadButton: document.querySelector("#cloudUploadButton"),
  cloudDownloadButton: document.querySelector("#cloudDownloadButton"),
  cloudLogoutButton: document.querySelector("#cloudLogoutButton"),
};

document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.value = todayKey;
});
elements.todayDate.textContent = dateFormatter.format(today);

elements.tabs.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

populateCalorieTargetForm();
initCloud();

elements.calorieTargetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.settings = {
    sex: data.get("sex"),
    height: Number(data.get("height")),
    age: Number(data.get("age")),
    dayType: data.get("dayType"),
    strengthCalories: Number(data.get("strengthCalories")),
    cardioCalories: Number(data.get("cardioCalories")),
    calorieDeficit: Number(data.get("calorieDeficit")),
  };
  saveAndRender();
});

elements.cloudAuthForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const credentials = getCloudCredentials();
  if (!credentials) return;
  await signInCloud(credentials);
});

elements.cloudSignupButton.addEventListener("click", async () => {
  const credentials = getCloudCredentials();
  if (!credentials) return;
  await signUpCloud(credentials);
});

elements.cloudUploadButton.addEventListener("click", async () => {
  await uploadCloudData();
});

elements.cloudDownloadButton.addEventListener("click", async () => {
  await downloadCloudData();
});

elements.cloudLogoutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
});

elements.favoriteFoodSelect.addEventListener("change", (event) => {
  const favorite = state.favoriteFoods.find((item) => item.id === event.target.value);
  if (!favorite) return;
  elements.foodForm.name.value = favorite.name;
  elements.foodForm.calories.value = favorite.calories;
  elements.foodForm.carbs.value = favorite.carbs || "";
  elements.foodForm.protein.value = favorite.protein || "";
  elements.foodForm.fat.value = favorite.fat || "";
});

elements.weightForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const date = data.get("date");
  const weight = Number(data.get("weight"));
  const note = String(data.get("note") || "").trim();
  const existing = editing.weightId
    ? state.weights.find((item) => item.id === editing.weightId)
    : state.weights.find((item) => item.date === date);

  if (existing) {
    existing.date = date;
    existing.weight = weight;
    existing.note = note;
  } else {
    state.weights.push({ id: crypto.randomUUID(), date, weight, note });
  }

  editing.weightId = null;
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  resetForm(event.currentTarget);
  saveAndRender();
});

elements.foodForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const selectedMeal = data.get("meal");
  const payload = {
    date: data.get("date"),
    meal: selectedMeal,
    name: String(data.get("name")).trim(),
    calories: Number(data.get("calories")),
    carbs: Number(data.get("carbs") || 0),
    protein: Number(data.get("protein") || 0),
    fat: Number(data.get("fat") || 0),
  };
  const existing = editing.foodId ? state.foods.find((item) => item.id === editing.foodId) : null;

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.foods.push({ id: crypto.randomUUID(), ...payload });
  }

  editing.foodId = null;
  resetForm(event.currentTarget);
  elements.foodForm.meal.value = selectedMeal;
  saveAndRender();
});

elements.favoriteFoodForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const payload = {
    name: String(data.get("name")).trim(),
    grams: Number(data.get("grams")),
    calories: Number(data.get("calories")),
    carbs: Number(data.get("carbs") || 0),
    protein: Number(data.get("protein") || 0),
    fat: Number(data.get("fat") || 0),
  };
  const existing = editing.favoriteFoodId
    ? state.favoriteFoods.find((item) => item.id === editing.favoriteFoodId)
    : null;

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.favoriteFoods.push({ id: crypto.randomUUID(), ...payload });
  }

  editing.favoriteFoodId = null;
  resetForm(event.currentTarget);
  saveAndRender();
});

elements.exerciseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const payload = {
    date: data.get("date"),
    type: String(data.get("type")).trim(),
    minutes: Number(data.get("minutes")),
    intensity: data.get("intensity"),
  };
  const existing = editing.exerciseId ? state.exercises.find((item) => item.id === editing.exerciseId) : null;

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.exercises.push({ id: crypto.randomUUID(), ...payload });
  }

  editing.exerciseId = null;
  resetForm(event.currentTarget);
  saveAndRender();
});

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const payload = {
    date: data.get("date"),
    time: data.get("time"),
    title: String(data.get("title")).trim(),
    category: data.get("category"),
    done: data.get("done") === "on",
  };
  const existing = editing.taskId ? state.tasks.find((item) => item.id === editing.taskId) : null;

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.tasks.push({ id: crypto.randomUUID(), ...payload });
  }

  editing.taskId = null;
  resetForm(event.currentTarget);
  saveAndRender();
});

elements.noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const payload = {
    date: data.get("date"),
    mood: data.get("mood"),
    content: String(data.get("content")).trim(),
  };
  const existing = editing.noteId ? state.notes.find((item) => item.id === editing.noteId) : null;

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.notes.push({ id: crypto.randomUUID(), ...payload });
  }

  editing.noteId = null;
  resetForm(event.currentTarget);
  saveAndRender();
});

elements.clearButton.addEventListener("click", () => {
  if (!confirm("确定要清空所有记录吗？")) return;
  state.weights = [];
  state.foods = [];
  state.exercises = [];
  state.favoriteFoods = [];
  state.tasks = [];
  state.notes = [];
  saveAndRender();
});

elements.exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `健康记录-${todayKey}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
});

elements.importInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    replaceState(imported);
  } catch {
    alert("导入失败，请选择之前导出的 TXT 文件。");
  } finally {
    event.target.value = "";
  }
});

render();

function loadState() {
  const fallback = {
    weights: [],
    foods: [],
    exercises: [],
    favoriteFoods: [],
    tasks: [],
    notes: [],
    settings: DEFAULT_CALORIE_SETTINGS,
  };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      weights: normalizeRecords(stored?.weights),
      foods: normalizeFoods(stored?.foods),
      exercises: normalizeRecords(stored?.exercises),
      favoriteFoods: normalizeFavoriteFoods(stored?.favoriteFoods),
      tasks: normalizeTasks(stored?.tasks),
      notes: normalizeRecords(stored?.notes),
      settings: normalizeSettings(stored?.settings),
    };
  } catch {
    return fallback;
  }
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => ({
    ...record,
    id: record.id || crypto.randomUUID(),
  }));
}

function normalizeFavoriteFoods(records) {
  return normalizeRecords(records).map((record) => ({
    ...record,
    grams: Number(record.grams || 0),
    carbs: Number(record.carbs || 0),
    protein: Number(record.protein || 0),
    fat: Number(record.fat || 0),
  }));
}

function normalizeFoods(records) {
  return normalizeRecords(records).map((record) => ({
    ...record,
    carbs: Number(record.carbs || 0),
    protein: Number(record.protein || 0),
    fat: Number(record.fat || 0),
  }));
}

function normalizeTasks(records) {
  return normalizeRecords(records).map((record) => ({
    ...record,
    time: normalizeTaskTime(record.time),
    category: TASK_CATEGORIES.includes(record.category) ? record.category : "未分类",
    done: Boolean(record.done),
  }));
}

function normalizeSettings(settings) {
  return {
    ...DEFAULT_CALORIE_SETTINGS,
    ...(settings || {}),
  };
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function exportState() {
  return {
    weights: state.weights,
    foods: state.foods,
    exercises: state.exercises,
    favoriteFoods: state.favoriteFoods,
    tasks: state.tasks,
    notes: state.notes,
    settings: state.settings,
  };
}

function replaceState(data) {
  state.weights = normalizeRecords(data?.weights);
  state.foods = normalizeFoods(data?.foods);
  state.exercises = normalizeRecords(data?.exercises);
  state.favoriteFoods = normalizeFavoriteFoods(data?.favoriteFoods);
  state.tasks = normalizeTasks(data?.tasks);
  state.notes = normalizeRecords(data?.notes);
  state.settings = normalizeSettings(data?.settings);
  populateCalorieTargetForm();
  saveAndRender();
}

async function initCloud() {
  const config = window.HEALTHY_SUPABASE_CONFIG || {};
  const isConfigured = Boolean(config.url && config.anonKey);
  const hasClient = Boolean(window.supabase?.createClient);

  if (!isConfigured) {
    setCloudStatus("未配置 Supabase");
    setCloudControls(false);
    return;
  }

  if (!hasClient) {
    setCloudStatus("Supabase 脚本未加载");
    setCloudControls(false);
    return;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  const { data } = await supabaseClient.auth.getSession();
  cloudUser = data.session?.user || null;
  updateCloudAuthUi();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    cloudUser = session?.user || null;
    updateCloudAuthUi();
  });
}

function getCloudCredentials() {
  if (!supabaseClient) {
    alert("Supabase 还没有初始化。请刷新页面；如果仍然出现，请检查 supabase-config.js 配置。");
    return null;
  }

  const form = elements.cloudAuthForm;
  const email = String(form.elements.email.value || "").trim();
  const password = String(form.elements.password.value || "");

  if (!email || !password) {
    alert("请输入邮箱和密码。");
    return null;
  }

  return { email, password };
}

async function signInCloud({ email, password }) {
  setCloudStatus("正在登录...");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    setCloudStatus("登录失败");
    alert(error.message);
    return;
  }
  setCloudStatus("已登录");
}

async function signUpCloud({ email, password }) {
  setCloudStatus("正在注册...");
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    setCloudStatus("注册失败");
    alert(error.message);
    return;
  }
  setCloudStatus("注册成功，请按 Supabase 设置确认邮箱或直接登录");
}

async function uploadCloudData() {
  if (!ensureCloudSignedIn()) return;
  setCloudStatus("正在上传...");
  const { error } = await supabaseClient.from("health_records").upsert({
    user_id: cloudUser.id,
    data: exportState(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    setCloudStatus("上传失败");
    alert(error.message);
    return;
  }

  setCloudStatus("已上传云端");
}

async function downloadCloudData() {
  if (!ensureCloudSignedIn()) return;
  setCloudStatus("正在读取...");
  const { data, error } = await supabaseClient
    .from("health_records")
    .select("data")
    .eq("user_id", cloudUser.id)
    .maybeSingle();

  if (error) {
    setCloudStatus("读取失败");
    alert(error.message);
    return;
  }

  if (!data?.data) {
    setCloudStatus("云端暂无数据");
    return;
  }

  replaceState(data.data);
  setCloudStatus("已读取云端数据");
}

function ensureCloudSignedIn() {
  if (!supabaseClient) {
    alert("请先配置 Supabase。");
    return false;
  }

  if (!cloudUser) {
    alert("请先登录账号。");
    return false;
  }

  return true;
}

function updateCloudAuthUi() {
  const signedIn = Boolean(cloudUser);
  setCloudStatus(signedIn ? `已登录：${cloudUser.email}` : "未登录");
  setCloudControls(signedIn);
}

function setCloudControls(signedIn) {
  elements.cloudUploadButton.disabled = !signedIn;
  elements.cloudDownloadButton.disabled = !signedIn;
  elements.cloudLogoutButton.disabled = !signedIn;
}

function setCloudStatus(message) {
  elements.cloudStatus.textContent = message;
}

function populateCalorieTargetForm() {
  const settings = normalizeSettings(state.settings);
  elements.calorieTargetForm.sex.value = settings.sex;
  elements.calorieTargetForm.height.value = settings.height;
  elements.calorieTargetForm.age.value = settings.age;
  elements.calorieTargetForm.dayType.value = settings.dayType;
  elements.calorieTargetForm.strengthCalories.value = settings.strengthCalories;
  elements.calorieTargetForm.cardioCalories.value = settings.cardioCalories;
  elements.calorieTargetForm.calorieDeficit.value = settings.calorieDeficit;
}

function resetForm(form) {
  form.reset();
  if (form.date) form.date.value = todayKey;
  const button = form.querySelector('button[type="submit"]');
  button.textContent = button.dataset.defaultText || button.textContent;
}

function switchView(viewName) {
  elements.tabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  Object.entries(elements.views).forEach(([name, view]) => {
    view.classList.toggle("active", name === viewName);
  });
}

function render() {
  const todayFoods = state.foods.filter((item) => item.date === todayKey);
  const todayExercises = state.exercises.filter((item) => item.date === todayKey);
  const todayTasks = sortTasks(state.tasks.filter((item) => item.date === todayKey));
  const todayNotes = state.notes.filter((item) => item.date === todayKey);
  const completedTasks = todayTasks.filter((item) => item.done).length;
  const latestWeight = [...state.weights].sort((a, b) => b.date.localeCompare(a.date))[0];
  const previousWeight = [...state.weights].sort((a, b) => b.date.localeCompare(a.date))[1];
  const calorieTotal = sum(todayFoods, "calories");
  const minuteTotal = sum(todayExercises, "minutes");
  const calorieTarget = calculateCalorieTarget(latestWeight, calorieTotal);
  const macroTotals = calculateMacroTotals(todayFoods);

  elements.todayWeight.textContent = latestWeight ? formatNumber(latestWeight.weight) : "--";
  elements.latestWeight.textContent = latestWeight ? formatNumber(latestWeight.weight) : "--";
  elements.todayCalories.textContent = calorieTotal;
  elements.calorieTotal.textContent = calorieTotal;
  elements.todayMinutes.textContent = minuteTotal;
  elements.minuteTotal.textContent = minuteTotal;
  elements.mealCount.textContent = `${todayFoods.length} 条饮食记录`;
  elements.workoutCount.textContent = `${todayExercises.length} 条运动记录`;
  elements.taskProgress.textContent = `${completedTasks}/${todayTasks.length}`;
  elements.taskCount.textContent = `${todayTasks.length} 条任务`;
  elements.weightChange.textContent = getWeightChangeText(latestWeight, previousWeight);
  elements.maxCalories.textContent = calorieTarget.maxCalories;
  elements.remainingCalories.textContent =
    calorieTarget.remaining >= 0
      ? `今天还可吃 ${calorieTarget.remaining} kcal`
      : `今天已超出 ${Math.abs(calorieTarget.remaining)} kcal`;
  elements.calorieBasis.textContent = `${calorieTarget.dayLabel}，按 ${formatNumber(calorieTarget.weight)} kg 计算`;
  elements.bmrValue.textContent = calorieTarget.bmr;
  elements.balanceCalories.textContent = calorieTarget.balanceCalories;
  elements.deficitValue.textContent = calorieTarget.deficit;
  renderMacros(macroTotals);

  renderList(elements.todayFoodList, todayFoods, foodToItem);
  renderList(elements.todayExerciseList, todayExercises, exerciseToItem);
  renderList(elements.todayTaskList, todayTasks, taskToItem);
  renderList(elements.todayNoteList, todayNotes, noteToItem);
  elements.foodEmptyHint.textContent = todayFoods.length ? `${todayFoods.length} 条` : "等待记录";
  elements.exerciseEmptyHint.textContent = todayExercises.length ? `${todayExercises.length} 条` : "等待记录";
  elements.taskEmptyHint.textContent = todayTasks.length ? `${completedTasks}/${todayTasks.length} 完成` : "等待记录";
  elements.noteEmptyHint.textContent = todayNotes.length ? `${todayNotes.length} 条` : "等待记录";

  renderHistory();
  renderFavoriteFoods();
  drawWeightChart();
}

function renderList(list, records, mapper) {
  list.innerHTML = "";
  if (!records.length) {
    list.append(elements.emptyTemplate.content.cloneNode(true));
    return;
  }
  records.forEach((record) => list.append(mapper(record)));
}

function foodToItem(food) {
  const macroText = formatFoodMacros(food);
  return makeItem({
    title: food.name,
    meta: macroText ? `${food.meal} · ${macroText}` : food.meal,
    value: `${food.calories} kcal`,
    onEdit: () => editFood(food.id),
    onDelete: () => deleteRecord("foods", food.id),
  });
}

function favoriteFoodToItem(food) {
  return makeItem({
    title: food.name,
    meta: [`${food.grams || 0} g`, formatFoodMacros(food)].filter(Boolean).join(" · "),
    value: `${food.calories} kcal`,
    onEdit: () => editFavoriteFood(food.id),
    onDelete: () => deleteRecord("favoriteFoods", food.id),
  });
}

function exerciseToItem(exercise) {
  return makeItem({
    title: exercise.type,
    meta: exercise.intensity,
    value: `${exercise.minutes} min`,
    onEdit: () => editExercise(exercise.id),
    onDelete: () => deleteRecord("exercises", exercise.id),
  });
}

function taskToItem(task) {
  const item = makeItem({
    title: task.title,
    meta: [formatTaskTime(task.time), getTaskCategoryLabel(task.category)].filter(Boolean).join(" · "),
    value: task.done ? "完成" : "待办",
    onEdit: () => editTask(task.id),
    onDelete: () => deleteRecord("tasks", task.id),
  });
  item.classList.toggle("done", task.done);
  const detail = item.querySelector(".record-item > div");
  detail.className = "task-check";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.setAttribute("aria-label", "切换任务完成状态");
  checkbox.addEventListener("change", () => toggleTask(task.id));
  detail.prepend(checkbox);
  return item;
}

function noteToItem(note) {
  return makeItem({
    title: note.content,
    meta: note.mood,
    value: "随心",
    onEdit: () => editNote(note.id),
    onDelete: () => deleteRecord("notes", note.id),
  });
}

function weightToItem(weight) {
  return makeItem({
    title: "体重",
    meta: weight.note || "当天记录",
    value: `${formatNumber(weight.weight)} kg`,
    onEdit: () => editWeight(weight.id),
    onDelete: () => deleteRecord("weights", weight.id),
  });
}

function makeItem({ title, meta, value, onEdit, onDelete }) {
  const item = document.createElement("li");
  item.className = "record-item";
  item.innerHTML = `
    <div>
      <span class="record-title"></span>
      <span class="record-meta"></span>
    </div>
    <div class="record-tools">
      <span class="pill"></span>
      <button class="tool-button" type="button" title="编辑" aria-label="编辑">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button class="tool-button danger-tool" type="button" title="删除" aria-label="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </svg>
      </button>
    </div>
  `;
  item.querySelector(".record-title").textContent = title;
  item.querySelector(".record-meta").textContent = meta;
  item.querySelector(".pill").textContent = value;
  item.querySelector(".tool-button").addEventListener("click", onEdit);
  item.querySelector(".danger-tool").addEventListener("click", onDelete);
  return item;
}

function editWeight(id) {
  const record = state.weights.find((item) => item.id === id);
  if (!record) return;
  editing.weightId = id;
  switchView("records");
  elements.weightForm.date.value = record.date;
  elements.weightForm.weight.value = record.weight;
  elements.weightForm.note.value = record.note || "";
  setSubmitText(elements.weightForm, "更新体重");
  elements.weightForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function editFood(id) {
  const record = state.foods.find((item) => item.id === id);
  if (!record) return;
  editing.foodId = id;
  switchView("records");
  elements.foodForm.date.value = record.date;
  elements.foodForm.meal.value = record.meal;
  elements.foodForm.name.value = record.name;
  elements.foodForm.calories.value = record.calories;
  elements.foodForm.carbs.value = record.carbs || "";
  elements.foodForm.protein.value = record.protein || "";
  elements.foodForm.fat.value = record.fat || "";
  setSubmitText(elements.foodForm, "更新饮食");
  elements.foodForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function editFavoriteFood(id) {
  const record = state.favoriteFoods.find((item) => item.id === id);
  if (!record) return;
  editing.favoriteFoodId = id;
  elements.favoriteFoodForm.name.value = record.name;
  elements.favoriteFoodForm.grams.value = record.grams || 0;
  elements.favoriteFoodForm.calories.value = record.calories;
  elements.favoriteFoodForm.carbs.value = record.carbs || "";
  elements.favoriteFoodForm.protein.value = record.protein || "";
  elements.favoriteFoodForm.fat.value = record.fat || "";
  setSubmitText(elements.favoriteFoodForm, "更新常吃食物");
  elements.favoriteFoodForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function editExercise(id) {
  const record = state.exercises.find((item) => item.id === id);
  if (!record) return;
  editing.exerciseId = id;
  switchView("records");
  elements.exerciseForm.date.value = record.date;
  elements.exerciseForm.type.value = record.type;
  elements.exerciseForm.minutes.value = record.minutes;
  elements.exerciseForm.intensity.value = record.intensity;
  setSubmitText(elements.exerciseForm, "更新运动");
  elements.exerciseForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function editTask(id) {
  const record = state.tasks.find((item) => item.id === id);
  if (!record) return;
  editing.taskId = id;
  switchView("records");
  elements.taskForm.elements.date.value = record.date;
  elements.taskForm.elements.time.value = record.time || "";
  elements.taskForm.elements.title.value = record.title;
  elements.taskForm.elements.category.value = TASK_CATEGORIES.includes(record.category)
    ? record.category
    : TASK_CATEGORIES[0];
  elements.taskForm.elements.done.checked = record.done;
  setSubmitText(elements.taskForm, "更新任务");
  elements.taskForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function editNote(id) {
  const record = state.notes.find((item) => item.id === id);
  if (!record) return;
  editing.noteId = id;
  switchView("records");
  elements.noteForm.elements.date.value = record.date;
  elements.noteForm.elements.mood.value = record.mood;
  elements.noteForm.elements.content.value = record.content;
  setSubmitText(elements.noteForm, "更新随心记录");
  elements.noteForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function getTaskCategoryLabel(category) {
  return TASK_CATEGORIES.includes(category) ? category : "未分类";
}

function formatTaskTime(time) {
  return time ? time : "";
}

function normalizeTaskTime(time) {
  if (!time) return "";
  if (TASK_TIME_BLOCKS.includes(time)) return time;

  const hour = Number(String(time).slice(0, 2));
  if (Number.isNaN(hour)) return "";
  if (hour < 11) return "上午";
  if (hour < 14) return "中午";
  if (hour < 18) return "下午";
  return "晚上";
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aIndex = TASK_TIME_BLOCKS.indexOf(a.time);
    const bIndex = TASK_TIME_BLOCKS.indexOf(b.time);
    if (aIndex === -1 && bIndex === -1) return a.title.localeCompare(b.title, "zh-CN");
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function setSubmitText(form, text) {
  const button = form.querySelector('button[type="submit"]');
  button.dataset.defaultText ||= button.textContent;
  button.textContent = text;
}

function deleteRecord(collectionName, id) {
  if (!confirm("确定删除这条记录吗？")) return;
  state[collectionName] = state[collectionName].filter((item) => item.id !== id);
  saveAndRender();
}

function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.done = !task.done;
  saveAndRender();
}

function renderFavoriteFoods() {
  elements.favoriteFoodSelect.innerHTML = '<option value="">手动输入</option>';
  state.favoriteFoods.forEach((food) => {
    const option = document.createElement("option");
    option.value = food.id;
    const macros = formatFoodMacros(food);
    option.textContent = `${food.name} (${food.grams || 0}g, ${food.calories} kcal${macros ? `, ${macros}` : ""})`;
    elements.favoriteFoodSelect.append(option);
  });

  renderList(elements.favoriteFoodList, state.favoriteFoods, favoriteFoodToItem);
}

function renderHistory() {
  const dates = new Set([
    ...state.weights.map((item) => item.date),
    ...state.foods.map((item) => item.date),
    ...state.exercises.map((item) => item.date),
    ...state.tasks.map((item) => item.date),
    ...state.notes.map((item) => item.date),
  ]);
  const sortedDates = [...dates].sort((a, b) => b.localeCompare(a));
  elements.historyList.innerHTML = "";

  if (!sortedDates.length) {
    elements.historyList.append(elements.emptyTemplate.content.cloneNode(true));
    return;
  }

  sortedDates.forEach((date) => {
    const section = document.createElement("section");
    section.className = "history-day";
    const weights = state.weights.filter((item) => item.date === date);
    const foods = state.foods.filter((item) => item.date === date);
    const exercises = state.exercises.filter((item) => item.date === date);
    const tasks = sortTasks(state.tasks.filter((item) => item.date === date));
    const notes = state.notes.filter((item) => item.date === date);
    const records = [
      ...weights.map(weightToItem),
      ...foods.map(foodToItem),
      ...exercises.map(exerciseToItem),
      ...tasks.map(taskToItem),
      ...notes.map(noteToItem),
    ];

    section.innerHTML = `<h4>${date}</h4>`;
    const list = document.createElement("ul");
    list.className = "record-list";
    records.forEach((record) => list.append(record));
    section.append(list);
    elements.historyList.append(section);
  });
}

function drawWeightChart() {
  const canvas = elements.chart;
  const context = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || 360;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fbfdf9";
  context.fillRect(0, 0, width, height);

  const records = state.weights.slice(-30);
  elements.chartRange.textContent = records.length ? `最近 ${records.length} 次` : "等待体重记录";

  const frame = {
    left: 74,
    right: width - 30,
    top: 34,
    bottom: height - 58,
  };

  if (!records.length) {
    drawWeightChartFrame(context, { ...frame, min: 0, max: 1 });
    context.fillStyle = "#68736d";
    context.font = "18px Microsoft YaHei, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("记录一次体重后，这里会出现趋势线", width / 2, height / 2);
    return;
  }

  const values = records.map((item) => item.weight);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.22, 0.8);
  const min = Math.floor((rawMin - padding) * 2) / 2;
  const max = Math.ceil((rawMax + padding) * 2) / 2;
  const points = records.map((record, index) => {
    const x =
      records.length === 1
        ? (frame.left + frame.right) / 2
        : frame.left + (index / (records.length - 1)) * (frame.right - frame.left);
    const y = frame.bottom - ((record.weight - min) / (max - min || 1)) * (frame.bottom - frame.top);
    return { x, y, record };
  });

  drawWeightChartFrame(context, { ...frame, min, max });
  drawWeightChartArea(context, points, frame.bottom, frame.top);

  context.strokeStyle = "#1f6f4d";
  context.lineWidth = 4;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();

  points.forEach((point, index) => {
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#1f6f4d";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(point.x, point.y, 6.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    const showLabel = points.length <= 10 || index === 0 || index === points.length - 1;
    if (showLabel) {
      context.fillStyle = "#1d2521";
      context.font = "700 13px Microsoft YaHei, sans-serif";
      context.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center";
      context.textBaseline = "bottom";
      context.fillText(`${formatNumber(point.record.weight)}kg`, point.x, point.y - 10);
    }
  });

  context.fillStyle = "#68736d";
  context.font = "13px Microsoft YaHei, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(records[0].date.slice(5), frame.left, height - 30);
  if (records.length > 2) {
    const middle = records[Math.floor(records.length / 2)];
    context.fillText(middle.date.slice(5), (frame.left + frame.right) / 2, height - 30);
  }
  context.fillText(records[records.length - 1].date.slice(5), frame.right, height - 30);
}

function drawWeightChartFrame(context, { left, right, top, bottom, min, max }) {
  const tickCount = 5;
  context.strokeStyle = "#e3ebe5";
  context.lineWidth = 1;
  context.fillStyle = "#68736d";
  context.font = "13px Microsoft YaHei, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let i = 0; i < tickCount; i += 1) {
    const progress = i / (tickCount - 1);
    const y = top + progress * (bottom - top);
    const value = max - progress * (max - min);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.fillText(`${formatNumber(value)} kg`, left - 12, y);
  }

  context.strokeStyle = "#9fb3a8";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, bottom);
  context.lineTo(right, bottom);
  context.stroke();
}

function drawWeightChartArea(context, points, bottom, top) {
  const gradient = context.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, "rgba(47, 125, 89, 0.24)");
  gradient.addColorStop(1, "rgba(47, 125, 89, 0.02)");
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.lineTo(points[points.length - 1].x, bottom);
  context.lineTo(points[0].x, bottom);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
}

function drawChart() {
  const canvas = elements.chart;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fbfdf9";
  context.fillRect(0, 0, width, height);

  const records = state.weights.slice(-30);
  elements.chartRange.textContent = records.length ? `最近 ${records.length} 次` : "等待体重记录";

  drawGrid(context, width, height);

  if (!records.length) {
    context.fillStyle = "#68736d";
    context.font = "18px Microsoft YaHei, sans-serif";
    context.textAlign = "center";
    context.fillText("记录一次体重后，这里会出现趋势线", width / 2, height / 2);
    return;
  }

  const values = records.map((item) => item.weight);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const left = 54;
  const right = width - 24;
  const top = 28;
  const bottom = height - 48;
  const points = records.map((record, index) => {
    const x = records.length === 1 ? (left + right) / 2 : left + (index / (records.length - 1)) * (right - left);
    const y = bottom - ((record.weight - min) / (max - min || 1)) * (bottom - top);
    return { x, y, record };
  });

  context.strokeStyle = "#2f7d59";
  context.lineWidth = 4;
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();

  points.forEach((point) => {
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#2f7d59";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(point.x, point.y, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });

  context.fillStyle = "#68736d";
  context.font = "14px Microsoft YaHei, sans-serif";
  context.textAlign = "right";
  context.fillText(`${formatNumber(max)} kg`, left - 12, top + 5);
  context.fillText(`${formatNumber(min)} kg`, left - 12, bottom + 5);
  context.textAlign = "center";
  context.fillText(records[0].date.slice(5), left, height - 18);
  context.fillText(records[records.length - 1].date.slice(5), right, height - 18);
}

function drawGrid(context, width, height) {
  context.strokeStyle = "#dfe7e1";
  context.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = 34 + i * 54;
    context.beginPath();
    context.moveTo(54, y);
    context.lineTo(width - 24, y);
    context.stroke();
  }
}

function getWeightChangeText(latest, previous) {
  if (!latest || !previous) return "还没有趋势";
  const diff = latest.weight - previous.weight;
  if (diff === 0) return "与上次持平";
  const direction = diff > 0 ? "增加" : "减少";
  return `较上次${direction} ${formatNumber(Math.abs(diff))} kg`;
}

function calculateCalorieTarget(latestWeight, todayCalories) {
  const settings = normalizeSettings(state.settings);
  const weight = Number(latestWeight?.weight || 93.3);
  const sexOffset = settings.sex === "female" ? -161 : 5;
  const bmr = weight * 9.99 + settings.height * 6.25 - settings.age * 4.92 + sexOffset;
  const noExerciseTotal = bmr / 0.7;
  const trainingBalance = noExerciseTotal + settings.strengthCalories + settings.cardioCalories;
  const restBalance = noExerciseTotal + settings.cardioCalories;
  const balanceCalories = settings.dayType === "training" ? trainingBalance : restBalance;
  const maxCalories = Math.max(0, balanceCalories - settings.calorieDeficit);

  return {
    weight,
    dayLabel: settings.dayType === "training" ? "力训日" : "休息日",
    bmr: Math.round(bmr),
    balanceCalories: Math.round(balanceCalories),
    deficit: Math.round(settings.calorieDeficit),
    maxCalories: Math.round(maxCalories),
    remaining: Math.round(maxCalories - todayCalories),
  };
}

function calculateMacroTotals(foods) {
  const carbs = sum(foods, "carbs");
  const protein = sum(foods, "protein");
  const fat = sum(foods, "fat");
  return {
    carbs,
    protein,
    fat,
    calories: carbs * 4 + protein * 4 + fat * 9,
  };
}

function renderMacros(macros) {
  const maxMacro = Math.max(macros.carbs, macros.protein, macros.fat, 1);
  elements.carbTotal.textContent = formatNumber(macros.carbs);
  elements.proteinTotal.textContent = formatNumber(macros.protein);
  elements.fatTotal.textContent = formatNumber(macros.fat);
  elements.macroCalories.textContent = `${Math.round(macros.calories)} kcal 来自碳蛋脂`;
  elements.carbBar.style.width = `${Math.max(4, (macros.carbs / maxMacro) * 100)}%`;
  elements.proteinBar.style.width = `${Math.max(4, (macros.protein / maxMacro) * 100)}%`;
  elements.fatBar.style.width = `${Math.max(4, (macros.fat / maxMacro) * 100)}%`;
}

function formatFoodMacros(food) {
  const parts = [];
  if (Number(food.carbs || 0) > 0) parts.push(`碳${formatNumber(food.carbs)}g`);
  if (Number(food.protein || 0) > 0) parts.push(`蛋${formatNumber(food.protein)}g`);
  if (Number(food.fat || 0) > 0) parts.push(`脂${formatNumber(food.fat)}g`);
  return parts.join(" / ");
}

function sum(records, key) {
  return records.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function formatNumber(value) {
  return Number(value).toFixed(1).replace(".0", "");
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
