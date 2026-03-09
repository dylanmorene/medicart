# MediCart — Seasonal Pharmacy MBA Engine

FP-Growth + Apriori hybrid · Self-Learning · SQLite backend · React dashboard

---

## Project Structure

```
medicart-app/
├── src/
│   └── App.jsx              ← React dashboard (copy MediCart.jsx here)
├── api.py                   ← Flask API server
├── medicart_engine.py       ← MBA engine (FP-Growth + Apriori)
├── vite.config.js           ← Vite proxy config
├── requirements.txt
└── package.json
```

---

## Setup

### 1. Install Python dependencies
```bash
pip install flask flask-cors pandas numpy
```

### 2. Install Node dependencies
```bash
npm install
```

---

## Running the App

Open **two terminals** in your project folder:

**Terminal 1 — Flask API**
```bash
python api.py
```
Compatibility with MacOS → Runs at http://localhost:5001

**Terminal 2 — React frontend**
```bash
npm run dev
```

Runs at http://localhost:5173

---

## How to Use

1. Open http://localhost:5173
2. **Gateway screen** → upload your first CSV (e.g. dataset_a_rainy.csv) → click Run MBA Engine
3. **Dashboard** → click "Upload Dataset" → upload second CSV (e.g. dataset_b_summer.csv)
4. **Dashboard** → click "Upload Dataset" → upload third CSV (e.g. dataset_c_holiday.csv)
5. Each upload runs drift detection against the previous dataset automatically

**Reset** — click the × button in the top-right to wipe all data and start over.

---

## CSV Format

Your CSV must have an `Items` column with comma-separated items per row:

```
TransactionID,Items
1,"Paracetamol, Vitamin C, Face Masks"
2,"Cough Syrup, Lozenges, Alcohol"
3,"Multivitamins, Zinc Supplements"
```

---

## Self-Learning Mechanisms

| Mechanism | Description |
|---|---|
| Auto-Threshold Tuning | Grid search over minsup/minconf targeting ~30 rules & ~50 itemsets |
| Composite Rule Scoring | Lift × 0.4 + Confidence × 0.35 + Support × 0.25 |
| Drift Detection | Compares rules across datasets — flags new, dropped, shifted |
| Version Caching | Each iteration's model stored for cross-dataset comparison |

---

## Dashboard Tabs

- **Homepage Ranking** — items ranked by transaction frequency
- **Top Bundles** — frequent itemsets (co-purchased groups)
- **Association Rules** — full rule metrics with composite score
- **Bought Together** — high-score pairs for checkout display
- **Promo Generator** — bundle deals with suggested discounts
- **Cross-Sell Sim** — live simulation: add items to cart, see suggestions
- **Shelf Placement** — co-purchase adjacency for store layout
- **Drift Detection** — rule changes vs previous dataset
- **Version Cache** — model snapshots per iteration