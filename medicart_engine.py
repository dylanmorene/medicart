"""
MediCart - Seasonal Pharmacy MBA Engine
Self-Learning Market Basket Analysis System
Implements FP-Growth + Apriori hybrid from scratch
"""

import pandas as pd
import numpy as np
import json
import os
from itertools import combinations
from collections import defaultdict, Counter
import copy

# ─────────────────────────────────────────────
# 1. DATA LOADING & CLEANING
# ─────────────────────────────────────────────

def load_transactions(filepath):
    df = pd.read_csv(filepath)
    df.columns = [c.strip() for c in df.columns]
    # Items column: split by comma, strip whitespace
    transactions = []
    for _, row in df.iterrows():
        items = [i.strip() for i in str(row['Items']).split(',') if i.strip() and i.strip() != 'nan']
        if items:
            transactions.append(frozenset(items))
    return transactions

def get_item_stats(transactions):
    all_items = []
    for t in transactions:
        all_items.extend(t)
    counts = Counter(all_items)
    return counts

# ─────────────────────────────────────────────
# 2. FP-GROWTH IMPLEMENTATION
# ─────────────────────────────────────────────

class FPNode:
    def __init__(self, item, count=0, parent=None):
        self.item = item
        self.count = count
        self.parent = parent
        self.children = {}
        self.link = None

class FPTree:
    def __init__(self, transactions, min_support_count):
        self.root = FPNode(None)
        self.header_table = {}
        self.min_support_count = min_support_count
        self._build(transactions)

    def _build(self, transactions):
        # Count frequencies
        item_counts = Counter()
        for t in transactions:
            for item in t:
                item_counts[item] += 1
        # Filter by min support
        freq_items = {k: v for k, v in item_counts.items() if v >= self.min_support_count}
        if not freq_items:
            return
        # Build header table
        for item in freq_items:
            self.header_table[item] = [freq_items[item], None]
        # Insert transactions
        for t in transactions:
            sorted_items = sorted(
                [i for i in t if i in freq_items],
                key=lambda x: freq_items[x],
                reverse=True
            )
            if sorted_items:
                self._insert(sorted_items, self.root)

    def _insert(self, items, node):
        if not items:
            return
        item = items[0]
        if item in node.children:
            node.children[item].count += 1
        else:
            new_node = FPNode(item, 1, node)
            node.children[item] = new_node
            # Update header table link
            if self.header_table[item][1] is None:
                self.header_table[item][1] = new_node
            else:
                current = self.header_table[item][1]
                while current.link is not None:
                    current = current.link
                current.link = new_node
        self._insert(items[1:], node.children[item])

def fp_growth(transactions, min_support_count, prefix=None, frequent_itemsets=None):
    if prefix is None:
        prefix = frozenset()
    if frequent_itemsets is None:
        frequent_itemsets = {}

    tree = FPTree(transactions, min_support_count)

    for item, (support, node) in tree.header_table.items():
        new_itemset = prefix | frozenset([item])
        frequent_itemsets[new_itemset] = support

        # Build conditional pattern base
        conditional_patterns = []
        current_node = node
        while current_node is not None:
            path = []
            parent = current_node.parent
            while parent.item is not None:
                path.append(parent.item)
                parent = parent.parent
            for _ in range(current_node.count):
                conditional_patterns.append(frozenset(path))
            current_node = current_node.link

        if conditional_patterns:
            fp_growth(conditional_patterns, min_support_count, new_itemset, frequent_itemsets)

    return frequent_itemsets

# ─────────────────────────────────────────────
# 3. APRIORI (for small/sparse datasets)
# ─────────────────────────────────────────────

def apriori(transactions, min_support_count):
    item_counts = Counter()
    for t in transactions:
        for item in t:
            item_counts[item] += 1

    frequent_itemsets = {}
    # Frequent 1-itemsets
    L1 = {frozenset([item]): count
          for item, count in item_counts.items()
          if count >= min_support_count}
    frequent_itemsets.update(L1)

    current_L = L1
    k = 2
    while current_L:
        items_in_L = list(set(item for itemset in current_L for item in itemset))
        candidates = {}
        for combo in combinations(items_in_L, k):
            candidate = frozenset(combo)
            count = sum(1 for t in transactions if candidate.issubset(t))
            if count >= min_support_count:
                candidates[candidate] = count
        frequent_itemsets.update(candidates)
        current_L = candidates
        k += 1

    return frequent_itemsets

# ─────────────────────────────────────────────
# 4. HYBRID SELECTOR
# ─────────────────────────────────────────────

def mine_frequent_itemsets(transactions, min_support_count):
    n = len(transactions)
    avg_basket = np.mean([len(t) for t in transactions])
    # Use FP-Growth for large/dense datasets, Apriori for small/sparse
    if n >= 500 or avg_basket >= 3:
        method = "FP-Growth"
        itemsets = fp_growth(transactions, min_support_count)
    else:
        method = "Apriori"
        itemsets = apriori(transactions, min_support_count)
    return itemsets, method

# ─────────────────────────────────────────────
# 5. ASSOCIATION RULES
# ─────────────────────────────────────────────

def generate_rules(frequent_itemsets, transactions, min_confidence):
    n = len(transactions)
    rules = []

    for itemset, support_count in frequent_itemsets.items():
        if len(itemset) < 2:
            continue
        support = support_count / n
        for i in range(1, len(itemset)):
            for antecedent in combinations(sorted(itemset), i):
                antecedent = frozenset(antecedent)
                consequent = itemset - antecedent

                ant_support = frequent_itemsets.get(antecedent, 0) / n
                if ant_support == 0:
                    continue
                con_support = frequent_itemsets.get(consequent, 0) / n

                confidence = support / ant_support if ant_support > 0 else 0
                if confidence < min_confidence:
                    continue

                lift = confidence / con_support if con_support > 0 else 0
                leverage = support - (ant_support * con_support)
                conviction = (1 - con_support) / (1 - confidence) if confidence < 1 else float('inf')

                rules.append({
                    'antecedent': sorted(antecedent),
                    'consequent': sorted(consequent),
                    'support': round(support, 4),
                    'confidence': round(confidence, 4),
                    'lift': round(lift, 4),
                    'leverage': round(leverage, 4),
                    'conviction': round(min(conviction, 999.0), 4),
                    'support_count': support_count
                })

    return rules

# ─────────────────────────────────────────────
# 6. CUSTOM RULE SCORING
# ─────────────────────────────────────────────

def score_rule(rule, w_lift=0.4, w_conf=0.35, w_sup=0.25):
    """Weighted composite score for rule ranking"""
    norm_lift = min(rule['lift'] / 10.0, 1.0)
    norm_conf = rule['confidence']
    norm_sup = min(rule['support'] / 0.3, 1.0)
    score = w_lift * norm_lift + w_conf * norm_conf + w_sup * norm_sup
    return round(score, 4)

def score_all_rules(rules):
    for r in rules:
        r['score'] = score_rule(r)
    return sorted(rules, key=lambda x: x['score'], reverse=True)

# ─────────────────────────────────────────────
# 7. AUTO-THRESHOLD TUNING
# ─────────────────────────────────────────────

def auto_tune_thresholds(transactions, target_rules=30, target_itemsets=50):
    """Automatically find minsup/minconf that yield quality rule count"""
    n = len(transactions)
    sup_candidates = [0.02, 0.03, 0.05, 0.07, 0.10, 0.15]
    conf_candidates = [0.3, 0.4, 0.5, 0.6, 0.7]

    best_sup, best_conf = 0.05, 0.5
    best_score = float('inf')

    for sup in sup_candidates:
        min_sup_count = max(2, int(sup * n))
        itemsets, _ = mine_frequent_itemsets(transactions, min_sup_count)
        for conf in conf_candidates:
            rules = generate_rules(itemsets, transactions, conf)
            itemset_diff = abs(len(itemsets) - target_itemsets)
            rule_diff = abs(len(rules) - target_rules)
            score = itemset_diff + rule_diff * 2
            if score < best_score:
                best_score = score
                best_sup = sup
                best_conf = conf

    return best_sup, best_conf

# ─────────────────────────────────────────────
# 8. DRIFT DETECTION
# ─────────────────────────────────────────────

def detect_drift(rules_v1, rules_v2, threshold=0.15):
    """Detect rules whose support shifted significantly between iterations"""
    v1_map = {(tuple(r['antecedent']), tuple(r['consequent'])): r for r in rules_v1}
    v2_map = {(tuple(r['antecedent']), tuple(r['consequent'])): r for r in rules_v2}

    drifted = []
    new_rules = []
    dropped_rules = []

    for key, r2 in v2_map.items():
        if key in v1_map:
            r1 = v1_map[key]
            delta = abs(r2['support'] - r1['support'])
            if delta >= threshold:
                drifted.append({
                    'rule': f"{list(key[0])} → {list(key[1])}",
                    'old_support': r1['support'],
                    'new_support': r2['support'],
                    'delta': round(delta, 4),
                    'direction': 'increased' if r2['support'] > r1['support'] else 'decreased'
                })
        else:
            new_rules.append(f"{list(key[0])} → {list(key[1])}")

    for key in v1_map:
        if key not in v2_map:
            dropped_rules.append(f"{list(key[0])} → {list(key[1])}")

    return {
        'drifted': drifted,
        'new_rules': new_rules[:10],
        'dropped_rules': dropped_rules[:10],
        'drift_count': len(drifted),
        'new_count': len(new_rules),
        'dropped_count': len(dropped_rules)
    }

# ─────────────────────────────────────────────
# 9. RECOMMENDATIONS ENGINE
# ─────────────────────────────────────────────

def get_homepage_ranking(frequent_itemsets, transactions):
    n = len(transactions)
    item_counts = Counter()
    for t in transactions:
        for item in t:
            item_counts[item] += 1
    ranked = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)
    return [{'item': item, 'frequency': count, 'support': round(count/n, 4)}
            for item, count in ranked]

def get_frequently_bought_together(rules, top_n=8):
    scored = score_all_rules(rules)
    seen = set()
    fbt = []
    for r in scored:
        key = frozenset(r['antecedent'] + r['consequent'])
        if key not in seen:
            seen.add(key)
            fbt.append({
                'bundle': r['antecedent'] + r['consequent'],
                'support': r['support'],
                'confidence': r['confidence'],
                'lift': r['lift'],
                'score': r['score']
            })
        if len(fbt) >= top_n:
            break
    return fbt

def get_cross_sell(cart_items, rules, top_n=5):
    cart = set(cart_items)
    suggestions = []
    for r in rules:
        ant = set(r['antecedent'])
        con = set(r['consequent'])
        if ant.issubset(cart) and not con.issubset(cart):
            suggestions.append({
                'trigger': list(ant),
                'suggestion': list(con),
                'confidence': r['confidence'],
                'lift': r['lift'],
                'score': r.get('score', 0)
            })
    suggestions.sort(key=lambda x: x['score'], reverse=True)
    return suggestions[:top_n]

def get_promo_recommendations(rules, frequent_itemsets, transactions, top_n=6):
    n = len(transactions)
    scored = score_all_rules(rules)
    promos = []
    for r in scored[:top_n]:
        bundle = r['antecedent'] + r['consequent']
        promo_type = "Bundle Deal" if len(bundle) == 2 else "Multi-Buy Promo"
        discount = min(30, int(r['lift'] * 5))
        promos.append({
            'bundle': bundle,
            'promo_type': promo_type,
            'suggested_discount': f"{discount}%",
            'support': r['support'],
            'confidence': r['confidence'],
            'lift': r['lift'],
            'rationale': f"Lift {r['lift']}x above random — high co-purchase signal"
        })
    return promos

def get_top_bundles(frequent_itemsets, transactions, min_size=2, top_n=10):
    n = len(transactions)
    bundles = [(list(k), v) for k, v in frequent_itemsets.items() if len(k) >= min_size]
    bundles.sort(key=lambda x: x[1], reverse=True)
    return [{'items': b[0], 'support_count': b[1], 'support': round(b[1]/n, 4)}
            for b in bundles[:top_n]]

def get_shelf_placement(frequent_itemsets, transactions):
    item_co = defaultdict(Counter)
    for t in transactions:
        items = list(t)
        for i in range(len(items)):
            for j in range(len(items)):
                if i != j:
                    item_co[items[i]][items[j]] += 1
    suggestions = []
    seen = set()
    for item, co_items in item_co.items():
        top_co = co_items.most_common(2)
        for co_item, count in top_co:
            key = tuple(sorted([item, co_item]))
            if key not in seen and count >= 3:
                seen.add(key)
                suggestions.append({
                    'item_a': item,
                    'item_b': co_item,
                    'co_purchases': count,
                    'insight': f"Place '{item}' near '{co_item}' — bought together {count}x"
                })
    suggestions.sort(key=lambda x: x['co_purchases'], reverse=True)
    return suggestions[:8]

# ─────────────────────────────────────────────
# 10. VERSION CACHE
# ─────────────────────────────────────────────

VERSION_CACHE = {}

def save_version(season, iteration, rules, itemsets, thresholds, transactions):
    n = len(transactions)
    key = f"{season}_v{iteration}"
    VERSION_CACHE[key] = {
        'season': season,
        'iteration': iteration,
        'n_transactions': n,
        'minsup': thresholds['minsup'],
        'minconf': thresholds['minconf'],
        'n_itemsets': len(itemsets),
        'n_rules': len(rules),
        'top_rules': score_all_rules(rules)[:5],
        'top_bundles': get_top_bundles(itemsets, transactions, top_n=5)
    }
    return key

# ─────────────────────────────────────────────
# 11. FULL PIPELINE RUN
# ─────────────────────────────────────────────

def run_pipeline(season_name, transactions, iteration, prev_rules=None):
    n = len(transactions)
    print(f"\n{'='*60}")
    print(f"  MediCart Pipeline | Season: {season_name} | Iteration {iteration}")
    print(f"  Transactions: {n}")
    print(f"{'='*60}")

    # Auto-tune thresholds
    minsup, minconf = auto_tune_thresholds(transactions)
    min_sup_count = max(2, int(minsup * n))
    print(f"  Auto-tuned → minsup={minsup} ({min_sup_count} txns), minconf={minconf}")

    # Mine itemsets
    itemsets, method = mine_frequent_itemsets(transactions, min_sup_count)
    print(f"  Mining method: {method} | Frequent itemsets: {len(itemsets)}")

    # Generate rules
    rules = generate_rules(itemsets, transactions, minconf)
    rules = score_all_rules(rules)
    print(f"  Association rules: {len(rules)}")

    # Drift detection
    drift_report = None
    if prev_rules:
        drift_report = detect_drift(prev_rules, rules)
        print(f"  Drift: {drift_report['drift_count']} shifted, {drift_report['new_count']} new, {drift_report['dropped_count']} dropped")

    # Save version
    thresholds = {'minsup': minsup, 'minconf': minconf}
    save_version(season_name, iteration, rules, itemsets, thresholds, transactions)

    # Build output bundle
    result = {
        'season': season_name,
        'iteration': iteration,
        'method': method,
        'n_transactions': n,
        'thresholds': thresholds,
        'min_sup_count': min_sup_count,
        'n_itemsets': len(itemsets),
        'n_rules': len(rules),
        'top_bundles': get_top_bundles(itemsets, transactions),
        'top_rules': rules[:20],
        'homepage_ranking': get_homepage_ranking(itemsets, transactions),
        'frequently_bought_together': get_frequently_bought_together(rules),
        'cross_sell_demo': get_cross_sell([], rules),
        'promo_recommendations': get_promo_recommendations(rules, itemsets, transactions),
        'shelf_placement': get_shelf_placement(itemsets, transactions),
        'drift_report': drift_report,
        'all_rules': rules
    }

    return result

# ─────────────────────────────────────────────
# 12. MAIN EXECUTION
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# 13. SQLITE SAVE FUNCTION
# ─────────────────────────────────────────────

def save_to_sqlite(all_results, db_path):
    import sqlite3

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Drop and recreate all tables fresh each run
    c.executescript("""
        DROP TABLE IF EXISTS seasons;
        DROP TABLE IF EXISTS homepage_ranking;
        DROP TABLE IF EXISTS top_bundles;
        DROP TABLE IF EXISTS association_rules;
        DROP TABLE IF EXISTS frequently_bought_together;
        DROP TABLE IF EXISTS promo_recommendations;
        DROP TABLE IF EXISTS shelf_placement;
        DROP TABLE IF EXISTS drift_report;
        DROP TABLE IF EXISTS version_cache;
        DROP TABLE IF EXISTS all_items;

        CREATE TABLE seasons (
                    season TEXT PRIMARY KEY,
                    method TEXT,
                    n_transactions INTEGER,
                    n_itemsets INTEGER,
                    n_rules INTEGER,
                    minsup REAL,
                    minconf REAL,
                    iteration INTEGER,
                    tagline TEXT,
                    theme_color TEXT
                );

        CREATE TABLE homepage_ranking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            rank INTEGER,
            item TEXT,
            frequency INTEGER,
            support REAL
        );

        CREATE TABLE top_bundles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            rank INTEGER,
            items TEXT,
            support_count INTEGER,
            support REAL
        );

        CREATE TABLE association_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            antecedent TEXT,
            consequent TEXT,
            support REAL,
            confidence REAL,
            lift REAL,
            leverage REAL,
            conviction REAL,
            score REAL
        );

        CREATE TABLE frequently_bought_together (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            bundle TEXT,
            support REAL,
            confidence REAL,
            lift REAL,
            score REAL
        );

        CREATE TABLE promo_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            bundle TEXT,
            promo_type TEXT,
            suggested_discount TEXT,
            support REAL,
            confidence REAL,
            lift REAL,
            rationale TEXT
        );

        CREATE TABLE shelf_placement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            item_a TEXT,
            item_b TEXT,
            co_purchases INTEGER,
            insight TEXT
        );

        CREATE TABLE drift_report (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            drift_count INTEGER,
            new_count INTEGER,
            dropped_count INTEGER,
            new_rules TEXT,
            dropped_rules TEXT
        );

        CREATE TABLE version_cache (
            key TEXT PRIMARY KEY,
            season TEXT,
            iteration INTEGER,
            n_transactions INTEGER,
            minsup REAL,
            minconf REAL,
            n_itemsets INTEGER,
            n_rules INTEGER
        );

        CREATE TABLE all_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            item TEXT,
            frequency INTEGER,
            support REAL
        );
    """)

    taglines = {
        "Rainy":   "Cold & flu season — equip your defense",
        "Summer":  "Heat, outdoors & travel — stay cool & protected",
        "Holiday": "Celebrations & reunions — manage chronic & festive health",
    }

    for season, result in all_results.items():
        if season == '_version_cache':
            continue

        # seasons table
        c.execute("INSERT INTO seasons (season,method,n_transactions,n_itemsets,n_rules,minsup,minconf,iteration,tagline,theme_color) VALUES (?,?,?,?,?,?,?,?,?,?)", (
            season,
            result['method'],
            result['n_transactions'],
            result['n_itemsets'],
            result['n_rules'],
            result['thresholds']['minsup'],
            result['thresholds']['minconf'],
            result['iteration'],
            taglines.get(season, ""),
            "#4a7fa5"
        ))

        # homepage_ranking
        for rank, item in enumerate(result['homepage_ranking'], 1):
            c.execute("INSERT INTO homepage_ranking (season,rank,item,frequency,support) VALUES (?,?,?,?,?)",
                (season, rank, item['item'], item['frequency'], item['support']))

        # all_items (same as homepage_ranking — full list)
        for item in result['homepage_ranking']:
            c.execute("INSERT INTO all_items (season,item,frequency,support) VALUES (?,?,?,?)",
                (season, item['item'], item['frequency'], item['support']))

        # top_bundles
        for rank, bundle in enumerate(result['top_bundles'], 1):
            c.execute("INSERT INTO top_bundles (season,rank,items,support_count,support) VALUES (?,?,?,?,?)",
                (season, rank, json.dumps(bundle['items']), bundle['support_count'], bundle['support']))

        # association_rules
        for rule in result['top_rules']:
            c.execute("INSERT INTO association_rules (season,antecedent,consequent,support,confidence,lift,leverage,conviction,score) VALUES (?,?,?,?,?,?,?,?,?)",
                (season, json.dumps(rule['antecedent']), json.dumps(rule['consequent']),
                 rule['support'], rule['confidence'], rule['lift'],
                 rule['leverage'], rule['conviction'], rule['score']))

        # frequently_bought_together
        for fbt in result['frequently_bought_together']:
            c.execute("INSERT INTO frequently_bought_together (season,bundle,support,confidence,lift,score) VALUES (?,?,?,?,?,?)",
                (season, json.dumps(fbt['bundle']), fbt['support'], fbt['confidence'], fbt['lift'], fbt['score']))

        # promo_recommendations
        for promo in result['promo_recommendations']:
            c.execute("INSERT INTO promo_recommendations (season,bundle,promo_type,suggested_discount,support,confidence,lift,rationale) VALUES (?,?,?,?,?,?,?,?)",
                (season, json.dumps(promo['bundle']), promo['promo_type'],
                 promo['suggested_discount'], promo['support'],
                 promo['confidence'], promo['lift'], promo['rationale']))

        # shelf_placement
        for shelf in result['shelf_placement']:
            c.execute("INSERT INTO shelf_placement (season,item_a,item_b,co_purchases,insight) VALUES (?,?,?,?,?)",
                (season, shelf['item_a'], shelf['item_b'], shelf['co_purchases'], shelf['insight']))

        # drift_report
        if result['drift_report']:
            dr = result['drift_report']
            c.execute("INSERT INTO drift_report (season,drift_count,new_count,dropped_count,new_rules,dropped_rules) VALUES (?,?,?,?,?,?)",
                (season, dr['drift_count'], dr['new_count'], dr['dropped_count'],
                 json.dumps(dr.get('new_rules', [])), json.dumps(dr.get('dropped_rules', []))))

    # version_cache
    for key, v in all_results.get('_version_cache', {}).items():
        c.execute("INSERT INTO version_cache VALUES (?,?,?,?,?,?,?,?)",
            (key, v['season'], v['iteration'], v['n_transactions'],
             v['minsup'], v['minconf'], v['n_itemsets'], v['n_rules']))

    conn.commit()
    conn.close()
    print(f"\n✅ Results saved to SQLite: {db_path}")
    print("   Tables: seasons, homepage_ranking, all_items, top_bundles,")
    print("           association_rules, frequently_bought_together,")
    print("           promo_recommendations, shelf_placement, drift_report, version_cache")

if __name__ == "__main__":
    print("\nMediCart Engine is a library module.")
    print("To use it, run: python api.py")
    print("Then upload your CSV datasets through the frontend at http://localhost:5173")