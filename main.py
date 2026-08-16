
import os, sqlite3, math, traceback
from datetime import datetime, timedelta
from kivy.core.window import Window
Window.clearcolor = (0.96, 0.96, 0.96, 1)

from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.button import Button
from kivy.uix.scrollview import ScrollView
from kivy.uix.textinput import TextInput
from kivy.uix.floatlayout import FloatLayout
from kivy.animation import Animation
from kivy.clock import Clock
from kivy.properties import StringProperty

from kivymd.app import MDApp
from kivymd.uix.screen import MDScreen
from kivymd.uix.screenmanager import MDScreenManager
from kivymd.uix.label import MDLabel, MDIcon
from kivymd.uix.card import MDCard
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.list import MDList, OneLineListItem, ThreeLineListItem
from kivymd.uix.toolbar import MDTopAppBar
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.dialog import MDDialog
from kivymd.toast import toast

MAIN_DB_PATH = "/storage/emulated/0/MOISES/Omega Ice System/omega_ice.db"
DB_PATHS = [MAIN_DB_PATH, "/storage/emulated/0/MOISES/omega_ice.db", "/storage/emulated/0/Download/omega_ice.db", "omega_ice.db"]
DB_NAME = MAIN_DB_PATH
OMEGA_LIGHT_BLUE = (0.12, 0.56, 1, 1)
OMEGA_BLUE = (0.12, 0.35, 0.75, 1)

def get_conn():
    try: os.makedirs(os.path.dirname(MAIN_DB_PATH), exist_ok=True)
    except: pass
    try:
        conn = sqlite3.connect(MAIN_DB_PATH, timeout=30, check_same_thread=False)
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA cache_size=-10000;")
        except: pass
        return conn
    except: pass
    for p in DB_PATHS:
        try:
            if os.path.exists(p): return sqlite3.connect(p, timeout=30, check_same_thread=False)
        except: continue
    return sqlite3.connect("omega_ice.db", timeout=30, check_same_thread=False)

class IOSToggleBar(MDCard):
    current_mode = StringProperty("SALE")
    def __init__(self, initial="SALE", **kw):
        super().__init__(**kw)
        self.current_mode = initial
        self.md_bg_color = [0.90, 0.90, 0.92, 1]
        self.radius = [22]
        self.size_hint_y = None
        self.height = dp(46)
        self.elevation = 0
        self.padding = [dp(3), dp(3)]
        self.float_root = FloatLayout()
        bg_box = BoxLayout()
        self.lbl_sale = MDLabel(text="SALE", halign="center", bold=True, font_size="12sp", theme_text_color="Custom", text_color=[0.45,0.45,0.45,1])
        self.lbl_machine = MDLabel(text="MACHINES", halign="center", bold=True, font_size="12sp", theme_text_color="Custom", text_color=[0.45,0.45,0.45,1])
        bg_box.add_widget(self.lbl_sale)
        bg_box.add_widget(self.lbl_machine)
        self.thumb = MDCard(md_bg_color=[1,1,1,1], radius=[18], elevation=3, size_hint=(0.5, 1), pos_hint={"x":0, "y":0})
        self.thumb_label = MDLabel(text=initial, halign="center", bold=True, font_size="12sp", theme_text_color="Custom", text_color=[0.0,0.66,0.27,1] if initial=="SALE" else [0.12,0.35,0.75,1])
        self.thumb.add_widget(self.thumb_label)
        self.float_root.add_widget(bg_box)
        self.float_root.add_widget(self.thumb)
        self.add_widget(self.float_root)
        self.float_root.bind(on_touch_down=self.on_bar_touch)
        self.update_visual()
    def on_bar_touch(self, instance, touch):
        if not self.collide_point(*touch.pos):
            return False
        if touch.x < self.center_x:
            self.switch_to("SALE")
        else:
            self.switch_to("MACHINE")
        return True
    def switch_to(self, mode):
        if self.current_mode == mode:
            return
        self.current_mode = mode
        target_x = 0 if mode == "SALE" else 0.5
        anim = Animation(pos_hint={"x": target_x, "y": 0}, duration=0.25, t='out_cubic')
        anim.start(self.thumb)
        self.thumb_label.text = "SALE" if mode=="SALE" else "MACHINES"
        self.thumb_label.text_color = [0.0,0.66,0.27,1] if mode=="SALE" else [0.12,0.35,0.75,1]
        app = MDApp.get_running_app()
        if mode == "SALE":
            app.sm.current = 'cashier'
        else:
            app.sm.current = 'machine_list'
    def update_visual(self):
        self.thumb.pos_hint = {"x":0, "y":0} if self.current_mode=="SALE" else {"x":0.5, "y":0}
        self.thumb_label.text = "SALE" if self.current_mode=="SALE" else "MACHINES"
        self.thumb_label.text_color = [0.0,0.66,0.27,1] if self.current_mode=="SALE" else [0.12,0.35,0.75,1]

def get_price_simple(kg_label, mode):
    base = {"1Kg":10,"5Kg":50,"10Kg":100,"25Kg":250}
    price = base.get(kg_label, 10)
    if mode=="PICKUP":
        price = max(1, price-1) if kg_label=="1Kg" else max(5, price-5)
    try:
        for p in DB_PATHS:
            if os.path.exists(p):
                conn=sqlite3.connect(p, timeout=5); cur=conn.cursor()
                col_map={"1Kg":"kg1","5Kg":"kg5","10Kg":"kg10","25Kg":"kg25"}
                col=col_map.get(kg_label,"kg1")
                ptype="PICKUP" if mode=="PICKUP" else "REGULAR"
                try:
                    cur.execute(f"SELECT {col} FROM price_settings WHERE type=? ORDER BY id DESC LIMIT 1",(ptype,))
                    r=cur.fetchone()
                    if r and r[0] and float(r[0])>0:
                        conn.close()
                        return float(r[0])
                except: pass
                conn.close()
    except: pass
    return float(price)

def clean_kg_display(kg_size):
    if not kg_size: return "1Kg"
    k=str(kg_size).strip().replace("KgKg","Kg")
    up=k.upper().replace("KG","").strip()
    if up.isdigit(): return f"{up}Kg"
    return k

def init_db():
    conn=get_conn(); cur=conn.cursor()
    try:
        cur.execute("""CREATE TABLE IF NOT EXISTS resellers (id INTEGER PRIMARY KEY AUTOINCREMENT, store_name TEXT UNIQUE, credit_balance REAL DEFAULT 0)""")
        try:
            cur.execute("DELETE FROM resellers WHERE UPPER(store_name)='AMO'")
            cur.execute("DELETE FROM resellers WHERE UPPER(store_name) IN ('TEST RESELLER','WALK-IN','TEST')")
        except: pass
        for name in ['AMO RESTO', 'OMG ICE']:
            try:
                cur.execute("INSERT OR IGNORE INTO resellers (store_name, credit_balance) VALUES (?, 0)", (name,))
            except: pass
        cur.execute("""CREATE TABLE IF NOT EXISTS daily_sales (id INTEGER PRIMARY KEY, sales_date TEXT, reseller_id INTEGER, quantity INTEGER, kg_size TEXT, total_sales REAL, mode TEXT, payment TEXT, reseller_name TEXT, notes TEXT)""")
        conn.commit()
    except Exception as e: print(e)
    conn.close()

def simple_btn(text, bg_color, text_color=[1,1,1,1]):
    btn=Button(text=text, background_color=bg_color, background_normal='', color=text_color, font_size=dp(12), bold=True)
    return btn



def ensure_machines():
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_name TEXT NOT NULL,
            date_purchase TEXT,
            unit_price REAL DEFAULT 0,
            power_rating TEXT,
            wattage REAL DEFAULT 0,
            vendor TEXT,
            capacity REAL DEFAULT 0,
            capacity_unit TEXT DEFAULT 'kg/day',
            pm_date TEXT,
            filter_change_date TEXT,
            notes TEXT
        )""")
        conn.commit(); conn.close()
    except Exception as e:
        print(f"ensure_machines err {e}")

def get_machines():
    try:
        ensure_machines()
        conn=get_conn(); cur=conn.cursor()
        try:
            cur.execute("SELECT id, machine_name, date_purchase, unit_price, power_rating, wattage, vendor, capacity, pm_date, filter_change_date, notes FROM machines ORDER BY machine_name")
            rows=cur.fetchall()
        except:
            cur.execute("SELECT * FROM machines ORDER BY id DESC")
            rows=cur.fetchall()
        conn.close()
        return rows
    except Exception as e:
        print(f"get_machines err {e}"); return []

def calc_machine_age(date_purchase_str):
    try:
        if not date_purchase_str: return "N/A"
        d = datetime.strptime(date_purchase_str, "%Y-%m-%d")
        diff = datetime.now() - d
        years = diff.days // 365
        months = (diff.days % 365) // 30
        if years>0:
            return f"{years}y {months}m old"
        else:
            return f"{months} months old"
    except:
        return "N/A"

def ensure_machine_logs():
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS machine_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id INTEGER NOT NULL,
            log_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            output_kg REAL DEFAULT 0,
            operating_hours REAL DEFAULT 0,
            kwph REAL DEFAULT 0,
            electricity_rate REAL DEFAULT 12,
            electricity_expense REAL DEFAULT 0,
            efficiency REAL DEFAULT 0,
            status TEXT DEFAULT 'RUNNING',
            cost_per_kg REAL DEFAULT 0
        )""")
        for col in ["cost_per_kg REAL DEFAULT 0"]:
            try: cur.execute(f"ALTER TABLE machine_logs ADD COLUMN {col}")
            except: pass
        conn.commit(); conn.close()
    except Exception as e:
        print(f"ensure_logs err {e}")

def get_machine_logs(machine_id, log_date):
    try:
        ensure_machine_logs()
        conn=get_conn(); cur=conn.cursor()
        cur.execute("SELECT * FROM machine_logs WHERE machine_id=? AND log_date=? ORDER BY start_time DESC", (machine_id, log_date))
        rows=cur.fetchall()
        if not rows:
            cur.execute("SELECT * FROM machine_logs WHERE machine_id=? AND status='RUNNING' ORDER BY log_date DESC, start_time DESC LIMIT 1", (machine_id,))
            running_row = cur.fetchone()
            if running_row:
                rows = [running_row]
            else:
                cur.execute("SELECT * FROM machine_logs WHERE machine_id=? ORDER BY log_date DESC, start_time DESC LIMIT 5", (machine_id,))
                rows = cur.fetchall()
        conn.close()
        return rows
    except Exception as e:
        print(f"get logs err {e}"); return []

def get_machine_running(machine_id, log_date=None):
    try:
        ensure_machine_logs()
        conn=get_conn(); cur=conn.cursor()
        if log_date:
            cur.execute("SELECT * FROM machine_logs WHERE machine_id=? AND log_date=? AND status='RUNNING' LIMIT 1", (machine_id, log_date))
        else:
            cur.execute("SELECT * FROM machine_logs WHERE machine_id=? AND status='RUNNING' LIMIT 1", (machine_id,))
        row=cur.fetchone(); conn.close(); return row
    except:
        return None

def get_any_running_log(machine_id):
    try:
        ensure_machine_logs()
        conn=get_conn(); cur=conn.cursor()
        cur.execute("SELECT * FROM machine_logs WHERE machine_id=? AND status='RUNNING' ORDER BY log_date DESC, start_time DESC LIMIT 1", (machine_id,))
        row=cur.fetchone(); conn.close(); return row
    except:
        return None

def get_latest_electricity_rate():
    try:
        conn=get_conn(); cur=conn.cursor()
        try:
            cur.execute("SELECT total_bill, total_kwh, price_per_day, kwh_per_day FROM electricity_daily WHERE (total_kwh>0 OR kwh_per_day>0) ORDER BY date DESC, id DESC LIMIT 1")
            row = cur.fetchone()
            if row:
                total_bill, total_kwh, price_day, kwh_day = row
                if total_bill and total_kwh and float(total_kwh)>0:
                    rate = float(total_bill)/float(total_kwh)
                    if 1 < rate < 50:
                        conn.close(); return rate
                if price_day and kwh_day and float(kwh_day)>0:
                    rate = float(price_day)/float(kwh_day)
                    if 1 < rate < 50:
                        conn.close(); return rate
        except: pass
        try:
            cur.execute("SELECT kwph FROM expenses WHERE category='Electricity' AND kwph>0 ORDER BY date DESC, id DESC LIMIT 1")
            row=cur.fetchone()
            if row and row[0]: conn.close(); return float(row[0])
        except: pass
        conn.close(); return 12.0
    except:
        return 12.0

def ensure_pm_history():
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS pm_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id INTEGER NOT NULL,
            pm_done_date TEXT NOT NULL,
            next_pm_due TEXT,
            filter_done_date TEXT,
            next_filter_due TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.commit(); conn.close()
    except Exception as e:
        print(f"ensure_pm_history err {e}")

def mark_pm_done_auto(machine_id):
    try:
        ensure_pm_history()
        conn=get_conn(); cur=conn.cursor()
        today = datetime.now().strftime("%Y-%m-%d")
        next_pm = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        cur.execute("UPDATE machines SET pm_date=?, filter_change_date=? WHERE id=?", (next_pm, next_pm, machine_id))
        cur.execute("INSERT INTO pm_history (machine_id, pm_done_date, next_pm_due, filter_done_date, next_filter_due, notes) VALUES (?,?,?,?,?,?)",
                    (machine_id, today, next_pm, today, next_pm, "Monthly PM + Filter Done"))
        conn.commit(); conn.close()
        return next_pm
    except Exception as e:
        print(f"auto pm err {e}"); return None

# ================= SCREENS =================



class CashierScreen(MDScreen):
    def __init__(self,**kw):
        super().__init__(**kw)
        self.md_bg_color=[0.96,0.96,0.96,1]
        self.current_mode="DELIVER"; self.pay_mode="Cash"; self.selected_kg="1Kg"
        self.selected_reseller_id=None; self.selected_reseller_name=""
        self.is_selecting=False
        self.edit_sale_id=None
        self.auto_updating=False  # para iwas loop

        scroll=ScrollView(size_hint=(1,1), do_scroll_x=False, bar_width=0)
        root=BoxLayout(orientation='vertical', padding=[dp(8),dp(8),dp(8),dp(20)], spacing=dp(8), size_hint_y=None)
        root.bind(minimum_height=root.setter('height'))

        # === iOS TOGGLE DINAGDAG LANG ===
        self.ios_toggle = IOSToggleBar(initial="SALE")
        root.add_widget(self.ios_toggle)

        top_card=MDCard(md_bg_color=[0.0,0.66,0.27,1], radius=[8], size_hint_y=None, height=dp(50), padding=[dp(10),dp(6)], elevation=0)
        top_box=BoxLayout(spacing=dp(6))
        left_box=BoxLayout(spacing=dp(6), size_hint_x=0.5)
        left_box.add_widget(MDLabel(text="CASHIER", font_size="14sp", bold=True, theme_text_color="Custom", text_color=[1,1,1,1]))
        right_box=BoxLayout(spacing=dp(6), size_hint_x=0.5)
        self.top_save_btn=simple_btn("SAVE", [1,1,1,1], [0.0,0.66,0.27,1])
        self.top_clear_btn=simple_btn("CLEAR", [0.3,0.3,0.3,1])
        self.top_save_btn.bind(on_release=self.save_sale)
        self.top_clear_btn.bind(on_release=self.clear_form)
        right_box.add_widget(self.top_save_btn)
        right_box.add_widget(self.top_clear_btn)
        top_box.add_widget(left_box)
        top_box.add_widget(right_box)
        top_card.add_widget(top_box)
        root.add_widget(top_card)

        total_card=MDCard(md_bg_color=[0.13,0.32,0.70,1], radius=[8], size_hint_y=None, height=dp(42), padding=[dp(12),dp(8)], elevation=0)
        total_row=BoxLayout()
        self.total_lbl=MDLabel(text="P0 | 0 X P0", font_size="13sp", bold=True, theme_text_color="Custom", text_color=[1,1,1,1])
        self.mode_lbl=MDLabel(text="DELIVER | Cash | 1Kg", halign="right", font_size="10sp", theme_text_color="Custom", text_color=[0.85,0.92,1,1])
        total_row.add_widget(self.total_lbl); total_row.add_widget(self.mode_lbl)
        total_card.add_widget(total_row); root.add_widget(total_card)

        res_card=MDCard(md_bg_color=[1,1,1,1], radius=[8], size_hint_y=None, height=dp(90), padding=[dp(10),dp(8)], elevation=0)
        res_box=BoxLayout(orientation='vertical', spacing=dp(4))
        self.res_f=TextInput(hint_text="Search reseller - ex: AMO", size_hint_y=None, height=dp(40), multiline=False, font_size=dp(13))
        sel_box=BoxLayout(size_hint_y=None, height=dp(28), spacing=dp(6))
        self.res_selected_lbl=MDLabel(text="SELECTED", font_size="10sp", bold=True, theme_text_color="Custom", text_color=[0.13,0.32,0.70,1])
        self.res_info_small=MDLabel(text="", font_size="9sp", halign="right")
        sel_box.add_widget(self.res_selected_lbl); sel_box.add_widget(self.res_info_small)
        res_box.add_widget(self.res_f); res_box.add_widget(sel_box)
        res_card.add_widget(res_box); root.add_widget(res_card)

        self.res_drop_card=MDCard(md_bg_color=[1,1,1,1], radius=[8], size_hint_y=None, height=dp(0), opacity=0, disabled=True, elevation=0)
        self.sv_drop=ScrollView(size_hint=(1,1), bar_width=dp(2))
        self.list_drop=BoxLayout(orientation='vertical', size_hint_y=None, spacing=dp(1))
        self.list_drop.bind(minimum_height=self.list_drop.setter('height'))
        self.sv_drop.add_widget(self.list_drop)
        self.res_drop_card.add_widget(self.sv_drop); root.add_widget(self.res_drop_card)

        qd_card=MDCard(md_bg_color=[1,1,1,1], radius=[8], size_hint_y=None, height=dp(80), padding=[dp(10),dp(8)], elevation=0)
        qd_main=BoxLayout(orientation='vertical', spacing=dp(4))
        qd_main.add_widget(MDLabel(text="QUANTITY + DATE", font_size="8sp", size_hint_y=None, height=dp(12)))
        qd_row=BoxLayout(spacing=dp(8), size_hint_y=None, height=dp(40))
        self.qty_f=TextInput(hint_text="Qty", input_filter="int", font_size=dp(13), multiline=False, halign="center")
        self.date_f=TextInput(text=datetime.now().strftime("%Y-%m-%d"), font_size=dp(12), multiline=False, halign="center")
        qd_row.add_widget(self.qty_f); qd_row.add_widget(self.date_f)
        qd_main.add_widget(qd_row); qd_card.add_widget(qd_main); root.add_widget(qd_card)

        fn_card=MDCard(md_bg_color=[1,1,1,1], radius=[8], size_hint_y=None, height=dp(80), padding=[dp(10),dp(8)], elevation=0)
        fn_main=BoxLayout(orientation='vertical', spacing=dp(4))
        fn_main.add_widget(MDLabel(text="FINAL TOTAL", font_size="8sp", bold=True, theme_text_color="Custom", text_color=[0.0,0.66,0.27,1], size_hint_y=None, height=dp(12)))
        fn_row=BoxLayout(spacing=dp(8), size_hint_y=None, height=dp(40))
        self.final_total_f=TextInput(hint_text="Auto total", font_size=dp(12), multiline=False, background_color=[0.95,1,0.95,1], readonly=False)
        self.note_f=TextInput(hint_text="Note", font_size=dp(12), multiline=False)
        fn_row.add_widget(self.final_total_f); fn_row.add_widget(self.note_f)
        fn_main.add_widget(fn_row); fn_card.add_widget(fn_main); root.add_widget(fn_card)

        root.add_widget(MDLabel(text="MODE & PAYMENT", font_size="9sp", bold=True, size_hint_y=None, height=dp(16)))
        mode_pay_row=BoxLayout(spacing=dp(6), size_hint_y=None, height=dp(44))
        self.btn_deliver=simple_btn("DELIVER", [0.18,0.55,0.95,1])
        self.btn_pickup=simple_btn("PICKUP", [0.6,0.6,0.6,1])
        self.btn_cash=simple_btn("CASH", [0.0,0.68,0.22,1])
        self.btn_credit=simple_btn("CREDIT", [0.6,0.6,0.6,1])
        self.btn_deliver.bind(on_release=self.set_deliver)
        self.btn_pickup.bind(on_release=self.set_pickup)
        self.btn_cash.bind(on_release=self.set_cash)
        self.btn_credit.bind(on_release=self.set_credit)
        mode_pay_row.add_widget(self.btn_deliver); mode_pay_row.add_widget(self.btn_pickup)
        mode_pay_row.add_widget(self.btn_cash); mode_pay_row.add_widget(self.btn_credit)
        root.add_widget(mode_pay_row)

        root.add_widget(MDLabel(text="KG SIZE", font_size="9sp", bold=True, size_hint_y=None, height=dp(16)))
        kg_row=BoxLayout(spacing=dp(6), size_hint_y=None, height=dp(44))
        self.kg_btns={}
        for kg in ["1Kg","5Kg","10Kg","25Kg"]:
            bg=[0.18,0.55,0.95,1] if kg=="1Kg" else [0.6,0.6,0.6,1]
            btn=simple_btn(kg, bg)
            btn.bind(on_release=lambda x,k=kg: self.set_kg(k))
            self.kg_btns[kg]=btn; kg_row.add_widget(btn)
        root.add_widget(kg_row)

        self.bottom_info=MDLabel(text="DELIVER | Cash | 1Kg = P0", halign="center", font_size="10sp", size_hint_y=None, height=dp(18))
        root.add_widget(self.bottom_info)

        latest_header=MDCard(md_bg_color=[0.2,0.2,0.2,1], radius=[8], size_hint_y=None, height=dp(36), padding=[dp(10),dp(6)], elevation=0)
        header_box=BoxLayout(spacing=dp(6))
        header_box.add_widget(MDLabel(text="10 LATEST - EDIT/DELETE", font_size="10sp", bold=True, theme_text_color="Custom", text_color=[1,1,1,1]))
        self.refresh_btn=simple_btn("REFRESH", [0.4,0.4,0.4,1])
        self.refresh_btn.bind(on_release=self.load_latest_sales)
        header_box.add_widget(self.refresh_btn)
        latest_header.add_widget(header_box)
        root.add_widget(latest_header)

        self.latest_card=MDCard(md_bg_color=[1,1,1,1], radius=[8], size_hint_y=None, height=dp(400), padding=[dp(6),dp(6)], elevation=0)
        self.latest_scroll=ScrollView(size_hint=(1,1), bar_width=dp(2))
        self.latest_list=BoxLayout(orientation='vertical', size_hint_y=None, spacing=dp(6))
        self.latest_list.bind(minimum_height=self.latest_list.setter('height'))
        self.latest_scroll.add_widget(self.latest_list)
        self.latest_card.add_widget(self.latest_scroll)
        root.add_widget(self.latest_card)

        scroll.add_widget(root); self.add_widget(scroll)
        # BIND - QTY text change triggers auto total
        self.qty_f.bind(text=self.on_qty_change)
        self.res_f.bind(text=self.on_reseller_search)
        self.res_f.bind(focus=self.on_reseller_focus)
        Clock.schedule_once(lambda dt: self.load_latest_sales(), 0.5)
        Clock.schedule_once(lambda dt: self.update_computation(), 0.6)

    def on_qty_change(self, inst, text):
        # LAGING AUTO COMPUTE PAG NAGBAGO QTY
        self.update_computation()

    def on_reseller_focus(self, inst, focused):
        if focused: Clock.schedule_once(lambda dt: self.show_reseller_dropdown(), 0.1)
        else: Clock.schedule_once(lambda dt: self.hide_reseller_dropdown(), 0.4)
    def on_reseller_search(self, inst, text):
        if self.is_selecting: return
        self.show_reseller_dropdown()
    def show_reseller_dropdown(self):
        try:
            conn=get_conn(); cur=conn.cursor()
            txt=self.res_f.text.strip().upper()
            base_where = "WHERE UPPER(store_name) NOT LIKE '%OMEGA%' AND UPPER(store_name)!='AMO' AND UPPER(store_name) NOT IN ('TEST RESELLER','WALK-IN','TEST')"
            if len(txt)<1:
                cur.execute(f"SELECT id, store_name FROM resellers {base_where} ORDER BY store_name LIMIT 20")
            else:
                cur.execute(f"SELECT id, store_name FROM resellers {base_where} AND UPPER(store_name) LIKE ? ORDER BY CASE WHEN UPPER(store_name) LIKE ? THEN 0 ELSE 1 END, store_name LIMIT 20", (f"%{txt}%", f"{txt}%"))
            rows=cur.fetchall(); conn.close()
            self.list_drop.clear_widgets()
            if not rows:
                self.res_drop_card.height=dp(0); self.sv_drop.height=dp(0)
                self.res_drop_card.opacity=0; self.res_drop_card.disabled=True
                return
            for rid, rname in rows:
                btn=Button(text=rname, size_hint_y=None, height=dp(40), background_color=[0.95,0.95,0.95,1], background_normal='', color=[0.15,0.15,0.15,1], font_size=dp(11))
                btn.bind(on_release=lambda x,i=rid,n=rname: self.select_reseller(i,n))
                self.list_drop.add_widget(btn)
            h=min(240, len(rows)*40+4)
            self.res_drop_card.height=dp(h); self.sv_drop.height=dp(h-4)
            self.res_drop_card.opacity=1; self.res_drop_card.disabled=False
        except Exception as e: print(f"dropdown err {e}")
    def hide_reseller_dropdown(self):
        self.res_drop_card.height=dp(0); self.sv_drop.height=dp(0)
        try: self.res_drop_card.opacity=0; self.res_drop_card.disabled=True
        except: pass
    def select_reseller(self, rid, rname):
        self.is_selecting=True
        self.selected_reseller_id=rid; self.selected_reseller_name=rname
        self.res_f.text=rname
        self.res_selected_lbl.text=f"SELECTED: {rname}"
        self.is_selecting=False
        self.hide_reseller_dropdown()
        self.update_computation()
    def set_deliver(self,*a):
        self.current_mode="DELIVER"
        self.btn_deliver.background_color=[0.18,0.55,0.95,1]; self.btn_pickup.background_color=[0.6,0.6,0.6,1]
        self.update_computation()
    def set_pickup(self,*a):
        self.current_mode="PICKUP"
        self.btn_pickup.background_color=[0.18,0.55,0.95,1]; self.btn_deliver.background_color=[0.6,0.6,0.6,1]
        self.update_computation()
    def set_cash(self,*a):
        self.pay_mode="Cash"
        self.btn_cash.background_color=[0.0,0.68,0.22,1]; self.btn_credit.background_color=[0.6,0.6,0.6,1]
        self.update_computation()
    def set_credit(self,*a):
        self.pay_mode="Utang"
        self.btn_credit.background_color=[0.95,0.55,0.05,1]; self.btn_cash.background_color=[0.6,0.6,0.6,1]
        self.update_computation()
    def set_kg(self, kg):
        self.selected_kg=kg
        for k,b in self.kg_btns.items():
            b.background_color=[0.18,0.55,0.95,1] if k==kg else [0.6,0.6,0.6,1]
        self.update_computation()

    def update_computation(self,*a):
        if self.auto_updating:
            return
        try:
            self.auto_updating=True
            txt=self.qty_f.text.strip()
            qty=int(txt) if txt.isdigit() else 0
            price=get_price_simple(self.selected_kg, self.current_mode)
            total=qty*price
            pay_display = "CREDIT" if self.pay_mode=="Utang" else self.pay_mode
            self.total_lbl.text=f"P{total:.0f} | {qty} X P{price:.0f}"
            self.mode_lbl.text=f"{self.current_mode} | {pay_display} | {clean_kg_display(self.selected_kg)}"
            self.bottom_info.text=f"{self.current_mode} | {pay_display} | {clean_kg_display(self.selected_kg)} = P{total:.0f}"
            # AUTO TOTAL - LAGING UPDATE KAHIT EDIT MODE
            if qty>0:
                self.final_total_f.text=str(int(total))
            else:
                self.final_total_f.text=""
        except Exception as e:
            print(f"auto total err {e}")
        finally:
            self.auto_updating=False

    def load_latest_sales(self,*a):
        try:
            self.latest_list.clear_widgets()
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT id, sales_date, reseller_name, quantity, kg_size, total_sales, mode, payment FROM daily_sales ORDER BY id DESC LIMIT 10")
            rows=cur.fetchall()
            conn.close()
            if not rows:
                self.latest_list.add_widget(MDLabel(text="No sales yet", halign="center", font_size="10sp", size_hint_y=None, height=dp(30)))
                return
            for sid, sdate, rname, qty, kg, total, mode, pay in rows:
                item_card=MDCard(md_bg_color=[0.97,0.97,0.97,1], radius=[6], size_hint_y=None, height=dp(72), padding=[dp(8),dp(6)], elevation=0)
                item_row=BoxLayout(spacing=dp(6))
                info_box=BoxLayout(orientation='vertical', size_hint_x=0.62, spacing=dp(1))
                pay_display = "CREDIT" if pay=="Utang" else pay
                line1=MDLabel(text=f"{rname[:18]} - {qty}x {clean_kg_display(kg)} = P{total:.0f}", font_size="11sp", bold=True, size_hint_y=None, height=dp(20), shorten=True)
                line2=MDLabel(text=f"{sdate} | {mode} | {pay_display} | ID:{sid}", font_size="8sp", theme_text_color="Custom", text_color=[0.5,0.5,0.5,1], size_hint_y=None, height=dp(16))
                info_box.add_widget(line1)
                info_box.add_widget(line2)
                info_box.add_widget(BoxLayout(size_hint_y=None, height=dp(4)))
                btn_box=BoxLayout(spacing=dp(4), size_hint_x=0.38)
                edit_btn=simple_btn("EDIT", [0.18,0.55,0.95,1])
                del_btn=simple_btn("DEL", [0.9,0.2,0.2,1])
                edit_btn.bind(on_release=lambda x,i=sid: self.edit_sale(i))
                del_btn.bind(on_release=lambda x,i=sid: self.delete_sale(i))
                btn_box.add_widget(edit_btn)
                btn_box.add_widget(del_btn)
                item_row.add_widget(info_box)
                item_row.add_widget(btn_box)
                item_card.add_widget(item_row)
                self.latest_list.add_widget(item_card)
            self.latest_card.height=dp(max(100, len(rows)*78 + 12))
        except Exception as e:
            print(f"load latest err {e}")

    def edit_sale(self, sale_id):
        try:
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT reseller_id, reseller_name, quantity, kg_size, total_sales, mode, payment, sales_date, notes FROM daily_sales WHERE id=?", (sale_id,))
            row=cur.fetchone()
            conn.close()
            if not row: return
            rid, rname, qty, kg, total, mode, pay, sdate, notes = row
            self.edit_sale_id=sale_id
            self.selected_reseller_id=rid
            self.selected_reseller_name=rname
            self.is_selecting=True
            self.res_f.text=rname
            self.res_selected_lbl.text=f"EDITING ID:{sale_id} - {rname}"
            self.is_selecting=False
            # Set qty first - this will trigger auto compute
            self.qty_f.text=str(qty)
            self.date_f.text=sdate or datetime.now().strftime("%Y-%m-%d")
            self.note_f.text=notes or ""
            self.selected_kg=clean_kg_display(kg)
            for k,b in self.kg_btns.items():
                b.background_color=[0.18,0.55,0.95,1] if k==self.selected_kg else [0.6,0.6,0.6,1]
            if mode=="DELIVER": 
                self.current_mode="DELIVER"
                self.btn_deliver.background_color=[0.18,0.55,0.95,1]; self.btn_pickup.background_color=[0.6,0.6,0.6,1]
            else: 
                self.current_mode="PICKUP"
                self.btn_pickup.background_color=[0.18,0.55,0.95,1]; self.btn_deliver.background_color=[0.6,0.6,0.6,1]
            if pay=="Utang": 
                self.pay_mode="Utang"
                self.btn_credit.background_color=[0.95,0.55,0.05,1]; self.btn_cash.background_color=[0.6,0.6,0.6,1]
            else: 
                self.pay_mode="Cash"
                self.btn_cash.background_color=[0.0,0.68,0.22,1]; self.btn_credit.background_color=[0.6,0.6,0.6,1]
            self.top_save_btn.text="UPDATE"
            self.top_save_btn.background_color=[0.95,0.55,0.05,1]
            # Force auto compute after setting all
            Clock.schedule_once(lambda dt: self.update_computation(), 0.1)
        except Exception as e:
            print(f"edit err {e}")

    def delete_sale(self, sale_id):
        try:
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT reseller_id, total_sales, payment FROM daily_sales WHERE id=?", (sale_id,))
            row=cur.fetchone()
            if row:
                rid, total, pay = row
                if pay=="Utang" and rid:
                    try:
                        cur.execute("SELECT credit_balance FROM resellers WHERE id=?", (rid,))
                        crow=cur.fetchone()
                        if crow:
                            cur_bal=crow[0] or 0
                            new_bal=max(0, cur_bal - total)
                            cur.execute("UPDATE resellers SET credit_balance=? WHERE id=?", (new_bal, rid))
                    except: pass
            cur.execute("DELETE FROM daily_sales WHERE id=?", (sale_id,))
            conn.commit(); conn.close()
            self.load_latest_sales()
        except Exception as e:
            print(f"delete err {e}")

    def save_sale(self,*a):
        try:
            qty=int(self.qty_f.text) if self.qty_f.text and self.qty_f.text.strip().isdigit() else 0
            if qty<=0:
                self.res_selected_lbl.text="Lagay QTY muna!"
                return
            if not self.selected_reseller_id:
                self.res_selected_lbl.text="Pili muna reseller!"
                return
            price=get_price_simple(self.selected_kg, self.current_mode)
            total=qty*price
            # Final total galing sa auto compute, pero pwede i-override kung may laman
            try:
                if self.final_total_f.text.strip():
                    total=float(self.final_total_f.text)
            except: pass
            kg_to_save=clean_kg_display(self.selected_kg)
            conn=get_conn(); cur=conn.cursor()
            if self.edit_sale_id:
                cur.execute("SELECT reseller_id, total_sales, payment FROM daily_sales WHERE id=?", (self.edit_sale_id,))
                old_row=cur.fetchone()
                old_total=0; old_pay=""; old_rid=None
                if old_row: old_rid, old_total, old_pay = old_row
                cur.execute("UPDATE daily_sales SET sales_date=?, reseller_id=?, reseller_name=?, quantity=?, kg_size=?, total_sales=?, mode=?, payment=?, notes=? WHERE id=?",
                            (self.date_f.text, self.selected_reseller_id, self.selected_reseller_name, qty, kg_to_save, total, self.current_mode, self.pay_mode, self.note_f.text, self.edit_sale_id))
                try:
                    if old_pay=="Utang" and old_rid:
                        cur.execute("SELECT credit_balance FROM resellers WHERE id=?", (old_rid,))
                        crow=cur.fetchone()
                        if crow:
                            cur_bal=crow[0] or 0
                            new_bal=max(0, cur_bal - old_total)
                            cur.execute("UPDATE resellers SET credit_balance=? WHERE id=?", (new_bal, old_rid))
                    if self.pay_mode=="Utang" and self.selected_reseller_id:
                        cur.execute("SELECT credit_balance FROM resellers WHERE id=?", (self.selected_reseller_id,))
                        crow=cur.fetchone()
                        if crow:
                            cur_bal=crow[0] or 0
                            new_bal=cur_bal + total
                            cur.execute("UPDATE resellers SET credit_balance=? WHERE id=?", (new_bal, self.selected_reseller_id))
                except: pass
            else:
                cur.execute("INSERT INTO daily_sales (sales_date, reseller_id, reseller_name, quantity, kg_size, total_sales, mode, payment, notes) VALUES (?,?,?,?,?,?,?,?,?)",
                            (self.date_f.text, self.selected_reseller_id, self.selected_reseller_name, qty, kg_to_save, total, self.current_mode, self.pay_mode, self.note_f.text))
                try:
                    if self.pay_mode == "Utang" and self.selected_reseller_id:
                        cur.execute("SELECT credit_balance FROM resellers WHERE id=?", (self.selected_reseller_id,))
                        row=cur.fetchone()
                        cur_bal = row[0] if row and row[0] else 0
                        new_bal = cur_bal + total
                        cur.execute("UPDATE resellers SET credit_balance=? WHERE id=?", (new_bal, self.selected_reseller_id))
                except: pass
            conn.commit(); conn.close()
            try:
                self.top_save_btn.text="SAVED!"
                Clock.schedule_once(lambda dt: self.reset_save_btn(), 1)
            except: pass
            self.clear_form()
            self.load_latest_sales()
        except Exception as e: print(e); import traceback; traceback.print_exc()

    def reset_save_btn(self):
        if self.edit_sale_id:
            self.top_save_btn.text="UPDATE"
            self.top_save_btn.background_color=[0.95,0.55,0.05,1]
        else:
            self.top_save_btn.text="SAVE"
            self.top_save_btn.background_color=[1,1,1,1]

    def clear_form(self,*a):
        self.qty_f.text=""; self.final_total_f.text=""; self.note_f.text=""; self.res_f.text=""
        self.selected_reseller_id=None; self.selected_reseller_name=""
        self.res_selected_lbl.text="SELECTED: (wala pa)"
        self.edit_sale_id=None
        self.top_save_btn.text="SAVE"
        self.top_save_btn.background_color=[1,1,1,1]
        self.update_computation()



class MachineListScreen(MDScreen):
    def __init__(self,**kw):
        super().__init__(**kw)
        root = MDBoxLayout(orientation='vertical', padding=dp(10), spacing=dp(6))
        root.add_widget(MDTopAppBar(title="OMEGA MACHINES", left_action_items=[], right_action_items=[["plus", lambda x: self.add_machine()], ["refresh", lambda x: self.load_machines()]]))
        search_card = MDCard(md_bg_color=(1,1,1,1), radius=[12], size_hint_y=None, height=dp(55), padding=dp(10), elevation=0)
        self.search_f = MDTextField(hint_text="Search machine...")
        self.search_f.bind(text=lambda inst, val: self.load_machines())
        search_card.add_widget(self.search_f)
        root.add_widget(search_card)
        sv = MDScrollView()
        self.list_w = MDList(padding=dp(5), spacing=dp(6))
        sv.add_widget(self.list_w)
        root.add_widget(sv)
        add_card = MDCard(md_bg_color=OMEGA_LIGHT_BLUE, radius=[14], size_hint_y=None, height=dp(62), elevation=0)
        add_inner = BoxLayout(spacing=dp(4), padding=dp(12))
        add_inner.add_widget(MDIcon(icon="plus-circle", theme_text_color="Custom", text_color=(1,1,1,1)))
        add_inner.add_widget(MDLabel(text="ADD NEW MACHINE", theme_text_color="Custom", text_color=(1,1,1,1), bold=True))
        add_card.add_widget(add_inner)
        add_card.bind(on_release=lambda x: self.add_machine())
        root.add_widget(add_card)
        root.add_widget(MDLabel(text="Same DB: omega_ice.db - Full Control", halign="center", font_style="Caption", size_hint_y=None, height=dp(18), theme_text_color="Hint"))
        self.add_widget(root)

    def add_machine(self):
        try:
            app=MDApp.get_running_app()
            s=app.sm.get_screen('machine_form')
            s.clear_form()
            app.sm.current='machine_form'
        except Exception as e: print(e)

    def on_enter(self): self.load_machines()

    def load_machines(self):
        try:
            self.list_w.clear_widgets()
            machines=get_machines()
            search = self.search_f.text.lower() if self.search_f.text else ""
            if len(machines)==0:
                self.list_w.add_widget(OneLineListItem(text="No machines yet - Tap + to add"))
                return
            for m in machines:
                try:
                    mid = m[0]; name = m[1] if len(m)>1 else "Unknown"
                    date_purchase = m[2] if len(m)>2 else ""
                    unit_price = m[3] if len(m)>3 else 0
                    wattage = m[5] if len(m)>5 else 0
                    vendor = m[6] if len(m)>6 else ""
                    capacity = m[7] if len(m)>7 else 0
                    pm_date = m[8] if len(m)>8 else ""
                    filter_date = m[9] if len(m)>9 else ""
                    if search and search not in str(name).lower() and search not in str(vendor).lower(): continue
                    age = calc_machine_age(date_purchase)
                    card = MDCard(md_bg_color=(1,1,1,1), radius=[14], size_hint_y=None, height=dp(95), padding=dp(12), elevation=0)
                    main_box = BoxLayout(orientation='horizontal', spacing=dp(4))
                    icon_box = MDCard(md_bg_color=(0.9,0.95,1,1), radius=[10], size_hint=(None,None), size=(dp(50),dp(50)))
                    icon_box.add_widget(MDIcon(icon="engine", halign="center", theme_text_color="Custom", text_color=OMEGA_LIGHT_BLUE))
                    text_box = BoxLayout(orientation='vertical', spacing=dp(2))
                    text_box.add_widget(MDLabel(text=f"{name}", bold=True, font_style="Subtitle2", size_hint_y=None, height=dp(22)))
                    text_box.add_widget(MDLabel(text=f"{wattage:.0f}W | {vendor or 'No vendor'} | {age}", font_style="Caption", theme_text_color="Hint", size_hint_y=None, height=dp(16)))
                    text_box.add_widget(MDLabel(text=f"Cap: {capacity:.0f}kg/d | PM: {pm_date or 'N/A'}", font_style="Caption", font_size="9sp", theme_text_color="Hint", size_hint_y=None, height=dp(16)))
                    arrow = MDIcon(icon="dots-vertical", theme_text_color="Hint")
                    main_box.add_widget(icon_box); main_box.add_widget(text_box); main_box.add_widget(arrow)
                    card.add_widget(main_box)
                    card.bind(on_release=lambda x, mid=mid: self.show_options(mid))
                    self.list_w.add_widget(card)
                except Exception as e: print(f"card err {e}"); continue
        except Exception as e: print(f"load err {e}"); traceback.print_exc()

    def show_options(self, machine_id):
        try:
            from kivymd.uix.dialog import MDDialog
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT machine_name, pm_date, filter_change_date FROM machines WHERE id=?", (machine_id,))
            r=cur.fetchone(); conn.close()
            name = r[0] if r else f"Machine {machine_id}"
            pm = r[1] if r and len(r)>1 else ""; filt = r[2] if r and len(r)>2 else ""
            content = BoxLayout(orientation='vertical', spacing=dp(4), size_hint_y=None, height=dp(220))
            content.add_widget(MDLabel(text=f"PM: {pm or 'N/A'} | Filter: {filt or 'N/A'}", font_style="Caption", theme_text_color="Hint", size_hint_y=None, height=dp(20)))
            grid = GridLayout(cols=2, spacing=dp(4), size_hint_y=None, height=dp(180))
            btn_monitor = MDRaisedButton(text="MONITOR", md_bg_color=OMEGA_LIGHT_BLUE)
            btn_edit = MDRaisedButton(text="EDIT", md_bg_color=(0.5,0.5,0.5,1))
            btn_history = MDRaisedButton(text="HISTORY", md_bg_color=(0.6,0.4,0.8,1))
            btn_pm = MDRaisedButton(text="PM DONE +30d", md_bg_color=(0.18,0.8,0.44,1))
            btn_delete = MDRaisedButton(text="DELETE", md_bg_color=(1,0.3,0.3,1))
            btn_close = MDFlatButton(text="CLOSE")
            grid.add_widget(btn_monitor); grid.add_widget(btn_edit); grid.add_widget(btn_history); grid.add_widget(btn_pm); grid.add_widget(btn_delete); grid.add_widget(btn_close)
            content.add_widget(grid)
            dialog = MDDialog(title=f"{name}", type="custom", content_cls=content)
            def go_monitor(*a): dialog.dismiss(); self.open_machine(machine_id)
            def go_edit(*a): dialog.dismiss(); self.edit_machine(machine_id)
            def go_history(*a):
                dialog.dismiss()
                app=MDApp.get_running_app(); s=app.sm.get_screen('pm_history'); s.set_machine(machine_id, name); app.sm.current='pm_history'
            def go_pm_done(*a):
                dialog.dismiss(); next_pm = mark_pm_done_auto(machine_id); toast(f"PM Done! Next: {next_pm} (+30d)"); self.load_machines()
            def go_delete(*a): dialog.dismiss(); self.delete_machine(machine_id)
            btn_monitor.bind(on_release=go_monitor); btn_edit.bind(on_release=go_edit); btn_history.bind(on_release=go_history); btn_pm.bind(on_release=go_pm_done); btn_delete.bind(on_release=go_delete); btn_close.bind(on_release=lambda x: dialog.dismiss())
            dialog.open()
        except Exception as e: print(e); traceback.print_exc()

    def open_machine(self, machine_id):
        try: app=MDApp.get_running_app(); s=app.sm.get_screen('machine_monitor'); s.machine_id=machine_id; app.sm.current='machine_monitor'
        except Exception as e: print(e)
    def edit_machine(self, machine_id):
        try: app=MDApp.get_running_app(); s=app.sm.get_screen('machine_form'); s.load_for_edit(machine_id); app.sm.current='machine_form'
        except Exception as e: print(e)
    def delete_machine(self, machine_id):
        try:
            from kivymd.uix.dialog import MDDialog
            def do_del(*a):
                conn=get_conn(); cur=conn.cursor()
                cur.execute("DELETE FROM machines WHERE id=?", (machine_id,)); cur.execute("DELETE FROM machine_logs WHERE machine_id=?", (machine_id,))
                conn.commit(); conn.close(); toast("Machine Deleted!"); dialog.dismiss(); self.load_machines()
            dialog = MDDialog(title="Delete?", text="Burahin na ba itong machine? Mabubura din logs nya.", buttons=[MDFlatButton(text="CANCEL", on_release=lambda x: dialog.dismiss()), MDRaisedButton(text="DELETE", md_bg_color=(1,0,0,1), on_release=do_del)])
            dialog.open()
        except Exception as e: print(e)

class MachineFormScreen(MDScreen):
    def __init__(self,**kw):
        super().__init__(**kw)
        self.edit_id=None
        root=MDBoxLayout(orientation='vertical', padding=dp(10), spacing=dp(8))
        self.ios_toggle = IOSToggleBar(initial="MACHINE")
        root.add_widget(self.ios_toggle)
        root.add_widget(MDTopAppBar(title="Machine Details Form", left_action_items=[["arrow-left", lambda x: setattr(MDApp.get_running_app().sm,'current','machine_list')]]))
        sv=MDScrollView()
        content=MDBoxLayout(orientation='vertical', spacing=dp(4), size_hint_y=None, padding=dp(10))
        content.bind(minimum_height=content.setter('height'))
        self.name_f=MDTextField(hint_text="Machine Name *")
        self.date_purchase_f=MDTextField(hint_text="Date Purchase YYYY-MM-DD", text=datetime.now().strftime("%Y-%m-%d"))
        self.age_lbl=MDLabel(text="Age: auto compute", size_hint_y=None, height=dp(25), theme_text_color="Hint")
        self.unit_price_f=MDTextField(hint_text="Unit Price", input_filter='float')
        self.power_f=MDTextField(hint_text="Power Rating ex: 220V / 2HP")
        self.wattage_f=MDTextField(hint_text="Wattage (W) - for KWPH calc", input_filter='float')
        self.vendor_f=MDTextField(hint_text="Vendor")
        self.capacity_f=MDTextField(hint_text="Capacity (kg/day)", input_filter='float')
        self.pm_f=MDTextField(hint_text="PM Date YYYY-MM-DD")
        self.filter_f=MDTextField(hint_text="Filter Change Date YYYY-MM-DD")
        self.notes_f=MDTextField(hint_text="Notes", multiline=True)
        for f in [self.name_f, self.date_purchase_f, self.age_lbl, self.unit_price_f, self.power_f, self.wattage_f, self.vendor_f, self.capacity_f, self.pm_f, self.filter_f, self.notes_f]:
            content.add_widget(f)
        self.date_purchase_f.bind(text=self.update_age)
        btn_row=MDBoxLayout(size_hint_y=None, height=dp(55), spacing=dp(4))
        save_btn=MDRaisedButton(text="SAVE MACHINE"); save_btn.bind(on_release=lambda x: self.save())
        back_btn=MDRaisedButton(text="BACK", md_bg_color=(0.5,0.5,0.5,1)); back_btn.bind(on_release=lambda x: setattr(MDApp.get_running_app().sm,'current','machine_list'))
        btn_row.add_widget(back_btn); btn_row.add_widget(save_btn)
        content.add_widget(btn_row)
        sv.add_widget(content); root.add_widget(sv); self.add_widget(root)

    def update_age(self, inst, val): self.age_lbl.text=f"Age: {calc_machine_age(val)}"
    def clear_form(self):
        self.edit_id=None
        self.name_f.text=""; self.date_purchase_f.text=datetime.now().strftime("%Y-%m-%d")
        self.unit_price_f.text=""; self.power_f.text=""; self.wattage_f.text=""
        self.vendor_f.text=""; self.capacity_f.text=""; self.pm_f.text=""; self.filter_f.text=""; self.notes_f.text=""
        self.age_lbl.text="Age: auto compute"
    def load_for_edit(self, mid):
        try:
            self.edit_id=mid
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT machine_name, date_purchase, unit_price, power_rating, wattage, vendor, capacity, pm_date, filter_change_date, notes FROM machines WHERE id=?", (mid,))
            r=cur.fetchone(); conn.close()
            if r:
                self.name_f.text=r[0] or ""; self.date_purchase_f.text=r[1] or ""; self.unit_price_f.text=str(r[2] or ""); self.power_f.text=r[3] or ""; self.wattage_f.text=str(r[4] or ""); self.vendor_f.text=r[5] or ""; self.capacity_f.text=str(r[6] or ""); self.pm_f.text=r[7] or ""; self.filter_f.text=r[8] or ""; self.notes_f.text=r[9] or ""
                self.age_lbl.text=f"Age: {calc_machine_age(r[1])}"
        except Exception as e: print(f"load edit err {e}")
    def save(self):
        try:
            if not self.name_f.text.strip(): toast("Machine Name required!"); return
            ensure_machines()
            conn=get_conn(); cur=conn.cursor()
            watt=float(self.wattage_f.text) if self.wattage_f.text else 0
            price=float(self.unit_price_f.text) if self.unit_price_f.text else 0
            cap=float(self.capacity_f.text) if self.capacity_f.text else 0
            if self.edit_id:
                cur.execute("UPDATE machines SET machine_name=?, date_purchase=?, unit_price=?, power_rating=?, wattage=?, vendor=?, capacity=?, pm_date=?, filter_change_date=?, notes=? WHERE id=?",
                            (self.name_f.text.strip(), self.date_purchase_f.text.strip(), price, self.power_f.text.strip(), watt, self.vendor_f.text.strip(), cap, self.pm_f.text.strip(), self.filter_f.text.strip(), self.notes_f.text.strip(), self.edit_id))
                toast("Machine Updated!")
            else:
                cur.execute("INSERT INTO machines (machine_name, date_purchase, unit_price, power_rating, wattage, vendor, capacity, pm_date, filter_change_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
                            (self.name_f.text.strip(), self.date_purchase_f.text.strip(), price, self.power_f.text.strip(), watt, self.vendor_f.text.strip(), cap, self.pm_f.text.strip(), self.filter_f.text.strip(), self.notes_f.text.strip()))
                toast(f"Machine Saved! Age: {calc_machine_age(self.date_purchase_f.text)}")
            conn.commit(); conn.close()
            MDApp.get_running_app().sm.current='machine_list'
        except Exception as e: toast(f"{e}"); print(f"save err {e}")

class MachineMonitoringScreen(MDScreen):
    def __init__(self,**kw):
        super().__init__(**kw)
        self.machine_id=None
        root=MDBoxLayout(orientation='vertical', padding=dp(10), spacing=dp(4))
        self.ios_toggle = IOSToggleBar(initial="MACHINE")
        root.add_widget(self.ios_toggle)
        root.add_widget(MDTopAppBar(title="Princeton MONITOR", left_action_items=[["arrow-left", lambda x: setattr(MDApp.get_running_app().sm,'current','machine_list')]], right_action_items=[["chart-bar", lambda x: self.open_graph()]]))
        date_card = MDCard(md_bg_color=(1,1,1,1), radius=[14], size_hint_y=None, height=dp(70), padding=dp(12), elevation=0)
        date_row = BoxLayout(spacing=dp(4))
        self.date_f=MDTextField(hint_text="Date YYYY-MM-DD", text=datetime.now().strftime("%Y-%m-%d"), size_hint_x=0.7)
        load_btn=MDRaisedButton(text="LOAD", md_bg_color=OMEGA_LIGHT_BLUE, size_hint_x=0.3)
        load_btn.bind(on_release=lambda x: self.load_logs())
        date_row.add_widget(self.date_f); date_row.add_widget(load_btn)
        date_card.add_widget(date_row); root.add_widget(date_card)
        summary_row = BoxLayout(size_hint_y=None, height=dp(85), spacing=dp(6))
        self.sum_h_card = MDCard(md_bg_color=OMEGA_LIGHT_BLUE, radius=[12], padding=dp(8), elevation=0)
        self.sum_h_box = BoxLayout(orientation='vertical')
        self.sum_h_box.add_widget(MDLabel(text="0.0h", halign="center", theme_text_color="Custom", text_color=(1,1,1,1), bold=True, font_size="14sp"))
        self.sum_h_box.add_widget(MDLabel(text="HOURS", halign="center", theme_text_color="Custom", text_color=(1,1,1,0.8), font_style="Caption", font_size="8sp"))
        self.sum_h_card.add_widget(self.sum_h_box)
        self.sum_kg_card = MDCard(md_bg_color=(0.18,0.8,0.44,1), radius=[12], padding=dp(8), elevation=0)
        self.sum_kg_box = BoxLayout(orientation='vertical')
        self.sum_kg_box.add_widget(MDLabel(text="0kg", halign="center", theme_text_color="Custom", text_color=(1,1,1,1), bold=True, font_size="14sp"))
        self.sum_kg_box.add_widget(MDLabel(text="OUTPUT", halign="center", theme_text_color="Custom", text_color=(1,1,1,0.8), font_style="Caption", font_size="8sp"))
        self.sum_kg_card.add_widget(self.sum_kg_box)
        self.sum_p_card = MDCard(md_bg_color=(1,0.6,0.2,1), radius=[12], padding=dp(8), elevation=0)
        self.sum_p_box = BoxLayout(orientation='vertical')
        self.sum_p_box.add_widget(MDLabel(text="P0", halign="center", theme_text_color="Custom", text_color=(1,1,1,1), bold=True, font_size="14sp"))
        self.sum_p_box.add_widget(MDLabel(text="ELEC COST", halign="center", theme_text_color="Custom", text_color=(1,1,1,0.8), font_style="Caption", font_size="8sp"))
        self.sum_p_card.add_widget(self.sum_p_box)
        self.sum_cpkg_card = MDCard(md_bg_color=(0.6,0.2,0.8,1), radius=[12], padding=dp(8), elevation=0)
        self.sum_cpkg_box = BoxLayout(orientation='vertical')
        self.sum_cpkg_box.add_widget(MDLabel(text="P0/kg", halign="center", theme_text_color="Custom", text_color=(1,1,1,1), bold=True, font_size="14sp"))
        self.sum_cpkg_box.add_widget(MDLabel(text="COST/KG", halign="center", theme_text_color="Custom", text_color=(1,1,1,0.8), font_style="Caption", font_size="8sp"))
        self.sum_cpkg_card.add_widget(self.sum_cpkg_box)
        summary_row.add_widget(self.sum_h_card); summary_row.add_widget(self.sum_kg_card); summary_row.add_widget(self.sum_p_card); summary_row.add_widget(self.sum_cpkg_card)
        root.add_widget(summary_row)
        self.title_lbl=MDLabel(text="Machine Name", halign="left", bold=True, font_style="Subtitle1", size_hint_y=None, height=dp(25), padding=[dp(5),0])
        root.add_widget(self.title_lbl)
        self.start_btn_card = MDCard(md_bg_color=(0.18,0.8,0.44,1), radius=[14], size_hint_y=None, height=dp(60), padding=dp(12), elevation=0)
        start_inner = BoxLayout(spacing=dp(4))
        start_inner.add_widget(MDIcon(icon="play-circle", font_size=dp(32), theme_text_color="Custom", text_color=(1,1,1,1)))
        start_inner.add_widget(MDLabel(text="START MACHINE - Save Start Time", theme_text_color="Custom", text_color=(1,1,1,1), bold=True))
        self.start_btn_card.add_widget(start_inner)
        self.start_btn_card.bind(on_release=lambda x: self.start_machine())
        root.add_widget(self.start_btn_card)
        sv=MDScrollView()
        self.list_w=MDList(padding=dp(5), spacing=dp(4))
        sv.add_widget(self.list_w)
        root.add_widget(sv)
        bottom=BoxLayout(size_hint_y=None, height=dp(55), spacing=dp(4))
        back_card=MDCard(md_bg_color=(0.4,0.4,0.45,1), radius=[12], elevation=0)
        back_card.add_widget(MDLabel(text="BACK", halign="center", theme_text_color="Custom", text_color=(1,1,1,1), bold=True))
        back_card.bind(on_release=lambda x: setattr(MDApp.get_running_app().sm,'current','machine_list'))
        graph_card=MDCard(md_bg_color=OMEGA_LIGHT_BLUE, radius=[12], elevation=0)
        graph_card.add_widget(MDLabel(text="GRAPH", halign="center", theme_text_color="Custom", text_color=(1,1,1,1), bold=True))
        graph_card.bind(on_release=lambda x: self.open_graph())
        bottom.add_widget(back_card); bottom.add_widget(graph_card)
        root.add_widget(bottom)
        self.add_widget(root)

    def on_enter(self):
        try:
            if not self.machine_id: return
            ensure_machines()
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT machine_name, wattage FROM machines WHERE id=?", (self.machine_id,))
            row=cur.fetchone(); conn.close()
            if row: self.title_lbl.text=f"{row[0]} • {row[1]:.0f}W"
            self.load_logs()
        except Exception as e: print(f"monitor on_enter {e}")

    def load_logs(self):
        try:
            self.list_w.clear_widgets()
            log_date=self.date_f.text.strip() or datetime.now().strftime("%Y-%m-%d")
            logs=get_machine_logs(self.machine_id, log_date)
            total_h=0; total_out=0; total_exp=0
            has_running=False
            latest_rate = get_latest_electricity_rate()
            for lg in logs:
                try:
                    lid=lg[0]; s_t=lg[3]; e_t=lg[4] or "RUNNING"; out=lg[5] or 0; oh=lg[6] or 0; rate=lg[8] or latest_rate; exp=lg[9] or 0; status=lg[11] if len(lg)>11 else "RUNNING"
                    cpkg = lg[12] if len(lg)>12 and lg[12] else (exp/out if out>0 else 0)
                    if status=="RUNNING": has_running=True
                    total_h+=oh; total_out+=out; total_exp+=exp
                    is_running = status=="RUNNING"
                    bg = (1,0.95,0.7,1) if is_running else (1,1,1,1)
                    ch = dp(78) if is_running else dp(85)
                    card = MDCard(md_bg_color=bg, radius=[12], size_hint_y=None, height=ch, padding=dp(8), elevation=0)
                    main_h = BoxLayout(orientation='horizontal', spacing=dp(8))
                    left_box = BoxLayout(orientation='horizontal', spacing=dp(6), size_hint_x=0.58)
                    left_box.add_widget(MDIcon(icon="progress-clock" if is_running else "check-circle", theme_text_color="Custom", text_color=(1,0.6,0.2,1) if is_running else (0.18,0.8,0.44,1), size_hint_x=None, width=dp(22)))
                    v_box = BoxLayout(orientation='vertical', spacing=dp(2))
                    v_box.add_widget(MDLabel(text=f"{s_t} - {e_t} = {oh:.1f}h", font_style="Subtitle2", bold=True, font_size="9sp", size_hint_y=None, height=dp(18)))
                    if is_running:
                        try:
                            conn=get_conn(); cur=conn.cursor()
                            cur.execute("CREATE TABLE IF NOT EXISTS machine_harvests (id INTEGER PRIMARY KEY AUTOINCREMENT, log_id INTEGER, kg REAL, timestamp TEXT)")
                            cur.execute("SELECT SUM(kg), COUNT(*) FROM machine_harvests WHERE log_id=?", (lid,))
                            hr=cur.fetchone(); conn.close()
                            hsum = hr[0] if hr and hr[0] else 0; hcnt = hr[1] if hr else 0
                        except: hsum=0; hcnt=0
                        v_box.add_widget(MDLabel(text=f"Harvest {hsum:.0f}kg ({hcnt}x) RUNNING", font_style="Caption", font_size="7sp", theme_text_color="Hint", size_hint_y=None, height=dp(14)))
                    else:
                        v_box.add_widget(MDLabel(text=f"Output {out:.0f}kg | P{exp:.0f} | P{cpkg:.2f}/kg", font_style="Caption", font_size="8sp", theme_text_color="Hint", size_hint_y=None, height=dp(16)))
                        v_box.add_widget(MDLabel(text=f"Rate P{rate:.2f}/kWh", font_size="6sp", theme_text_color="Hint", size_hint_y=None, height=dp(12)))
                    left_box.add_widget(v_box); main_h.add_widget(left_box)
                    if is_running:
                        right_box = BoxLayout(orientation='horizontal', spacing=dp(6), size_hint_x=0.42, size_hint_y=None, height=dp(36), pos_hint={'center_y':0.5})
                        from kivy.uix.button import Button
                        add_btn = Button(text="ADD", background_normal='', background_color=(0.18,0.8,0.44,1), color=(1,1,1,1), font_size=dp(10), size_hint_x=0.5, bold=True)
                        add_btn.bind(on_release=lambda btn, _lid=lid: self.add_harvest_running_popup(_lid))
                        stop_btn = Button(text="STOP", background_normal='', background_color=(1,0.3,0.3,1), color=(1,1,1,1), font_size=dp(10), size_hint_x=0.5, bold=True)
                        stop_btn.bind(on_release=lambda btn, _lid=lid: self.stop_machine(_lid))
                        right_box.add_widget(add_btn); right_box.add_widget(stop_btn); main_h.add_widget(right_box)
                    card.add_widget(main_h)
                    if not is_running: card.bind(on_release=lambda x, lid=lid: self.edit_log(lid))
                    self.list_w.add_widget(card)
                except Exception as e: print(e); continue
            try:
                avg_cpkg = total_exp/total_out if total_out>0 else 0
                self.sum_h_box.children[1].text=f"{total_h:.1f}h"
                self.sum_kg_box.children[1].text=f"{total_out:.0f}kg"
                self.sum_p_box.children[1].text=f"P{total_exp:.0f}"
                self.sum_cpkg_box.children[1].text=f"P{avg_cpkg:.2f}"
            except: pass
            if has_running:
                self.start_btn_card.md_bg_color=(0.6,0.6,0.6,1)
                self.start_btn_card.children[0].children[1].text="MACHINE RUNNING..."
            else:
                self.start_btn_card.md_bg_color=(0.18,0.8,0.44,1)
                self.start_btn_card.children[0].children[1].text="START MACHINE - Save Start Time"
            if len(self.list_w.children)==0:
                self.list_w.add_widget(OneLineListItem(text=f"No logs for {log_date}"))
        except Exception as e: print(f"load_logs err {e}"); traceback.print_exc()

    def start_machine(self):
        try:
            if not self.machine_id: toast("No machine selected!"); return
            ensure_machine_logs()
            curr_date = self.date_f.text.strip() or datetime.now().strftime("%Y-%m-%d")
            running_same_date = get_machine_running(self.machine_id, curr_date)
            if running_same_date: toast("Machine already running today!"); return
            any_running = get_any_running_log(self.machine_id)
            if any_running:
                other_date = any_running[2] if len(any_running)>2 else "other date"
                toast(f"May running pa from {other_date}! Stop mo muna."); self.date_f.text = other_date; self.load_logs(); return
            conn=get_conn(); cur=conn.cursor()
            cur.execute("INSERT INTO machine_logs (machine_id, log_date, start_time, status) VALUES (?,?,?,?)", (self.machine_id, curr_date, datetime.now().strftime("%H:%M:%S"), "RUNNING"))
            conn.commit(); conn.close(); toast("Machine Started!"); self.load_logs()
        except Exception as e: print(f"start err {e}")

    def add_harvest_running_popup(self, log_id):
        try:
            from kivymd.uix.dialog import MDDialog
            content=BoxLayout(orientation='vertical', spacing=dp(8), size_hint_y=None, height=dp(100))
            self.harvest_temp_f=MDTextField(hint_text="Harvest kg ex: 12", input_filter='float')
            content.add_widget(self.harvest_temp_f)
            def do_add(*a):
                try:
                    kg=float(self.harvest_temp_f.text) if self.harvest_temp_f.text else 0
                    if kg<=0: toast("Lagay kg"); return
                    conn=get_conn(); cur=conn.cursor()
                    cur.execute("CREATE TABLE IF NOT EXISTS machine_harvests (id INTEGER PRIMARY KEY AUTOINCREMENT, log_id INTEGER, kg REAL, timestamp TEXT)")
                    cur.execute("INSERT INTO machine_harvests (log_id, kg, timestamp) VALUES (?,?,?)", (log_id, kg, datetime.now().strftime("%H:%M:%S")))
                    conn.commit()
                    cur.execute("SELECT SUM(kg) FROM machine_harvests WHERE log_id=?", (log_id,))
                    total=cur.fetchone()[0] or 0; conn.close()
                    dialog.dismiss(); toast(f"Added {kg}kg Total {total:.0f}kg - tuloy pa machine"); self.load_logs()
                except Exception as e: print(e)
            dialog=MDDialog(title=f"Add Harvest Log {log_id}", type="custom", content_cls=content, buttons=[MDFlatButton(text="CANCEL", on_release=lambda x: dialog.dismiss()), MDRaisedButton(text="ADD", on_release=do_add)])
            dialog.open()
        except Exception as e: print(e)

    def stop_machine(self, log_id):
        try:
            from kivymd.uix.dialog import MDDialog
            latest_rate = get_latest_electricity_rate()
            try:
                conn=get_conn(); cur=conn.cursor()
                cur.execute("CREATE TABLE IF NOT EXISTS machine_harvests (id INTEGER PRIMARY KEY AUTOINCREMENT, log_id INTEGER, kg REAL, timestamp TEXT)")
                cur.execute("SELECT SUM(kg) FROM machine_harvests WHERE log_id=?", (log_id,))
                hr=cur.fetchone(); harvest_total = hr[0] if hr and hr[0] else 0; conn.close()
            except: harvest_total=0
            content=BoxLayout(orientation='vertical', spacing=dp(8), size_hint_y=None, height=dp(220))
            self.stop_end_f=MDTextField(hint_text="End Time HH:MM:SS", text=datetime.now().strftime("%H:%M:%S"))
            self.stop_out_f=MDTextField(hint_text=f"Output kg - auto total {harvest_total:.0f}kg", text=str(int(harvest_total)) if harvest_total>0 else "", input_filter='float')
            self.stop_rate_f=MDTextField(hint_text=f"Rate P/kWh - Auto P{latest_rate:.4f}", text=str(latest_rate), input_filter='float')
            rate_info = MDLabel(text=f"Rate P{latest_rate:.4f}/kWh | Total harvest {harvest_total:.0f}kg", font_style="Caption", font_size="8sp", theme_text_color="Hint", size_hint_y=None, height=dp(20))
            content.add_widget(self.stop_end_f); content.add_widget(self.stop_out_f); content.add_widget(self.stop_rate_f); content.add_widget(rate_info)
            def do_save(*args):
                try:
                    end_t=self.stop_end_f.text.strip(); out=float(self.stop_out_f.text) if self.stop_out_f.text else harvest_total; rate=float(self.stop_rate_f.text) if self.stop_rate_f.text else latest_rate
                    conn=get_conn(); cur=conn.cursor()
                    cur.execute("SELECT start_time, machine_id FROM machine_logs WHERE id=?", (log_id,)); r=cur.fetchone()
                    if not r: conn.close(); return
                    start_t, mid=r
                    cur.execute("SELECT wattage FROM machines WHERE id=?", (mid,)); mr=cur.fetchone(); watt=mr[0] if mr and mr[0] else 0
                    fmt="%H:%M:%S"
                    try:
                        s=datetime.strptime(start_t, fmt); e=datetime.strptime(end_t, fmt)
                        diff=(e-s).total_seconds()/3600
                        if diff<0: diff+=24
                    except: diff=0
                    kwph=(watt/1000)*diff if watt else 0; expense=kwph*rate; eff=(out/diff) if diff>0 else 0; cost_per_kg = expense/out if out>0 else 0
                    cur.execute("UPDATE machine_logs SET end_time=?, output_kg=?, operating_hours=?, kwph=?, electricity_rate=?, electricity_expense=?, efficiency=?, status='COMPLETED', cost_per_kg=? WHERE id=?",
                                (end_t, out, diff, kwph, rate, expense, eff, cost_per_kg, log_id))
                    conn.commit(); conn.close(); dialog.dismiss(); toast(f"Saved! {out:.0f}kg in {diff:.2f}h"); self.load_logs()
                except Exception as e: print(f"do_save err {e}")
            dialog=MDDialog(title=f"STOP - Total {harvest_total:.0f}kg", type="custom", content_cls=content, buttons=[MDFlatButton(text="CANCEL", on_release=lambda x: dialog.dismiss()), MDRaisedButton(text="SAVE", on_release=do_save)])
            dialog.open()
        except Exception as e: print(f"stop err {e}")

    def edit_log(self, log_id):
        try:
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT status FROM machine_logs WHERE id=?", (log_id,)); r=cur.fetchone(); conn.close()
            if not r: return
            if r[0]=="RUNNING":
                from kivymd.uix.dialog import MDDialog
                def go_add(*a): dialog.dismiss(); self.add_harvest_running_popup(log_id)
                def go_stop(*a): dialog.dismiss(); self.stop_machine(log_id)
                dialog = MDDialog(title=f"RUNNING Log #{log_id}", text="Add harvest o Stop?", buttons=[MDFlatButton(text="ADD HARVEST", on_release=go_add), MDFlatButton(text="STOP", on_release=go_stop)])
                dialog.open()
            else: self.show_completed_options(log_id)
        except Exception as e: print(e)

    def show_completed_options(self, log_id):
        try:
            from kivymd.uix.dialog import MDDialog
            def go_edit(*a): dialog.dismiss(); self.edit_completed_log(log_id)
            def go_delete(*a): dialog.dismiss(); self.delete_log(log_id)
            dialog = MDDialog(title=f"Log #{log_id}", text="Ano gagawin?", buttons=[MDFlatButton(text="EDIT", on_release=go_edit), MDFlatButton(text="DELETE", theme_text_color="Custom", text_color=(1,0,0,1), on_release=go_delete), MDFlatButton(text="CLOSE", on_release=lambda x: dialog.dismiss())])
            dialog.open()
        except Exception as e: print(e)

    def edit_completed_log(self, log_id):
        try:
            from kivymd.uix.dialog import MDDialog
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT start_time, end_time, output_kg, electricity_rate, machine_id, cost_per_kg FROM machine_logs WHERE id=?", (log_id,))
            r=cur.fetchone(); conn.close()
            if not r: return
            old_start, old_end, old_out, old_rate, mid, old_cpkg = r
            latest_rate = get_latest_electricity_rate()
            if not old_rate or old_rate==12: old_rate = latest_rate
            content=BoxLayout(orientation='vertical', spacing=dp(8), size_hint_y=None, height=dp(350))
            self.edit_start_f=MDTextField(hint_text="Start Time HH:MM:SS", text=old_start or "")
            self.edit_end_f=MDTextField(hint_text="End Time HH:MM:SS", text=old_end or datetime.now().strftime("%H:%M:%S"))
            self.edit_out_f=MDTextField(hint_text="Output kg", text=str(old_out or ""), input_filter='float')
            self.edit_rate_f=MDTextField(hint_text=f"Rate P/kWh P{latest_rate:.4f}", text=str(old_rate or latest_rate), input_filter='float')
            info_lbl = MDLabel(text=f"Latest Rate: P{latest_rate:.4f} | Old Cost P{old_cpkg or 0:.2f}/kg", font_style="Caption", font_size="8sp", theme_text_color="Hint", size_hint_y=None, height=dp(20))
            content.add_widget(self.edit_start_f); content.add_widget(self.edit_end_f); content.add_widget(self.edit_out_f); content.add_widget(self.edit_rate_f); content.add_widget(info_lbl)
            def do_update(*args):
                try:
                    start_t=self.edit_start_f.text.strip(); end_t=self.edit_end_f.text.strip(); out=float(self.edit_out_f.text) if self.edit_out_f.text else 0; rate=float(self.edit_rate_f.text) if self.edit_rate_f.text else latest_rate
                    conn=get_conn(); cur=conn.cursor()
                    cur.execute("SELECT wattage FROM machines WHERE id=?", (mid,)); mr=cur.fetchone(); watt=mr[0] if mr and mr[0] else 0
                    fmt="%H:%M:%S"
                    try: s=datetime.strptime(start_t, fmt); e=datetime.strptime(end_t, fmt); diff=(e-s).total_seconds()/3600; 
                    except: diff=0
                    if diff<0: diff+=24
                    kwph=(watt/1000)*diff if watt else 0; expense=kwph*rate; eff=(out/diff) if diff>0 else 0; cost_per_kg = expense/out if out>0 else 0
                    cur.execute("UPDATE machine_logs SET start_time=?, end_time=?, output_kg=?, operating_hours=?, kwph=?, electricity_rate=?, electricity_expense=?, efficiency=?, cost_per_kg=? WHERE id=?",
                                (start_t, end_t, out, diff, kwph, rate, expense, eff, cost_per_kg, log_id))
                    conn.commit(); conn.close(); dialog.dismiss(); toast(f"Updated! {diff:.1f}h | P{expense:.0f} | P{cost_per_kg:.2f}/kg"); self.load_logs()
                except Exception as e: print(f"update err {e}"); toast(f"{e}")
            dialog=MDDialog(title=f"EDIT Log #{log_id}", type="custom", content_cls=content, buttons=[MDFlatButton(text="CANCEL", on_release=lambda x: dialog.dismiss()), MDRaisedButton(text="UPDATE", on_release=do_update)])
            dialog.open()
        except Exception as e: print(f"edit completed err {e}")

    def delete_log(self, log_id):
        try:
            from kivymd.uix.dialog import MDDialog
            def do_del(*a):
                conn=get_conn(); cur=conn.cursor(); cur.execute("DELETE FROM machine_logs WHERE id=?", (log_id,)); conn.commit(); conn.close()
                dialog.dismiss(); toast("Log Deleted!"); self.load_logs()
            dialog=MDDialog(title="Delete Log?", text=f"Burahin Log #{log_id}?", buttons=[MDFlatButton(text="CANCEL", on_release=lambda x: dialog.dismiss()), MDRaisedButton(text="DELETE", md_bg_color=(1,0,0,1), on_release=do_del)])
            dialog.open()
        except Exception as e: print(e)

    def open_graph(self):
        try: app=MDApp.get_running_app(); s=app.sm.get_screen('machine_analytics'); s.machine_id=self.machine_id; app.sm.current='machine_analytics'
        except Exception as e: print(e)

class MachineAnalyticsScreen(MDScreen):
    def __init__(self,**kw):
        super().__init__(**kw)
        self.machine_id=None
        root=MDBoxLayout(orientation='vertical', padding=dp(10), spacing=dp(8))
        self.ios_toggle = IOSToggleBar(initial="MACHINE")
        root.add_widget(self.ios_toggle)
        root.add_widget(MDTopAppBar(title="Machine Analytics", left_action_items=[["arrow-left", lambda x: setattr(MDApp.get_running_app().sm,'current','machine_monitor')]]))
        self.title_lbl=MDLabel(text="Machine Graph", halign="center", bold=True, size_hint_y=None, height=dp(30))
        root.add_widget(self.title_lbl)
        date_row=MDBoxLayout(size_hint_y=None, height=dp(50), spacing=dp(8))
        self.month_f=MDTextField(hint_text="Month YYYY-MM", text=datetime.now().strftime("%Y-%m"))
        load_btn=MDRaisedButton(text="LOAD GRAPH"); load_btn.bind(on_release=lambda x: self.load_graph())
        date_row.add_widget(self.month_f); date_row.add_widget(load_btn)
        root.add_widget(date_row)
        self.summary_lbl=MDLabel(text="Summary", halign="center", size_hint_y=None, height=dp(60))
        root.add_widget(self.summary_lbl)
        sv=MDScrollView(); self.list_w=MDList(); sv.add_widget(self.list_w); root.add_widget(sv)
        back_btn=MDRaisedButton(text="BACK", size_hint_y=None, height=dp(50)); back_btn.bind(on_release=lambda x: setattr(MDApp.get_running_app().sm,'current','machine_monitor'))
        root.add_widget(back_btn); self.add_widget(root)

    def on_enter(self):
        try:
            if self.machine_id:
                conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT machine_name FROM machines WHERE id=?", (self.machine_id,)); r=cur.fetchone(); conn.close()
                if r: self.title_lbl.text=f"{r[0]} - Monthly Report"
            self.load_graph()
        except Exception as e: print(e)

    def load_graph(self):
        try:
            self.list_w.clear_widgets()
            if not self.machine_id: return
            month_txt=self.month_f.text.strip() or datetime.now().strftime("%Y-%m")
            ensure_machine_logs()
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT log_date, SUM(operating_hours), SUM(output_kg), SUM(electricity_expense), AVG(efficiency) FROM machine_logs WHERE machine_id=? AND log_date LIKE ? AND status='COMPLETED' GROUP BY log_date ORDER BY log_date", (self.machine_id, f"{month_txt}%"))
            rows=cur.fetchall(); conn.close()
            total_h=0; total_out=0; total_exp=0
            for r in rows:
                d=r[0]; h=r[1] or 0; out=r[2] or 0; exp=r[3] or 0; eff=r[4] or 0
                total_h+=h; total_out+=out; total_exp+=exp
                bar = "#" * int(h) if h<20 else "#" * 20
                item=ThreeLineListItem(text=f"{d}: {h:.1f}h {bar}", secondary_text=f"Output {out:.0f}kg | P{exp:.0f}", tertiary_text=f"Eff {eff:.1f} kg/h")
                self.list_w.add_widget(item)
            self.summary_lbl.text=f"MONTH {month_txt} TOTAL: {total_h:.1f}h | {total_out:.0f}kg | P{total_exp:.0f}"
            if len(rows)==0: self.list_w.add_widget(OneLineListItem(text="No data this month"))
        except Exception as e: print(f"graph err {e}"); traceback.print_exc()

class PMHistoryScreen(MDScreen):
    def __init__(self,**kw):
        super().__init__(**kw)
        self.machine_id=None
        root=MDBoxLayout(orientation='vertical', padding=dp(10), spacing=dp(4))
        self.ios_toggle = IOSToggleBar(initial="MACHINE")
        root.add_widget(self.ios_toggle)
        root.add_widget(MDTopAppBar(title="PM History", left_action_items=[["arrow-left", lambda x: setattr(MDApp.get_running_app().sm,'current','machine_list')]]))
        self.title_lbl=MDLabel(text="Machine PM History", halign="center", bold=True, size_hint_y=None, height=dp(30))
        root.add_widget(self.title_lbl)
        sv=MDScrollView(); self.list_w=MDList(padding=dp(5), spacing=dp(4)); sv.add_widget(self.list_w); root.add_widget(sv)
        self.add_widget(root)
    def set_machine(self, mid, name):
        self.machine_id=mid; self.title_lbl.text=f"{name} - PM History"; self.load_history()
    def on_enter(self):
        if self.machine_id: self.load_history()
    def load_history(self):
        try:
            self.list_w.clear_widgets()
            ensure_pm_history()
            conn=get_conn(); cur=conn.cursor()
            cur.execute("SELECT pm_done_date, next_pm_due, filter_done_date, next_filter_due, notes, created_at FROM pm_history WHERE machine_id=? ORDER BY id DESC", (self.machine_id,))
            rows=cur.fetchall(); conn.close()
            if not rows:
                self.list_w.add_widget(OneLineListItem(text="No PM history yet - Mark PM Done +30d to create")); return
            for pm_done, next_pm, filt_done, next_filt, notes, created in rows:
                card=MDCard(md_bg_color=(1,1,1,1), radius=[12], size_hint_y=None, height=dp(95), padding=dp(12), elevation=0)
                vbox=BoxLayout(orientation='vertical', spacing=dp(3))
                vbox.add_widget(MDLabel(text=f"Done: {pm_done} -> Next: {next_pm or 'N/A'}", bold=True, font_style="Caption", size_hint_y=None, height=dp(20)))
                vbox.add_widget(MDLabel(text=f"Filter: {filt_done or '-'} -> Next: {next_filt or 'N/A'}", font_style="Caption", theme_text_color="Hint", size_hint_y=None, height=dp(18)))
                vbox.add_widget(MDLabel(text=f"{notes} | {created}", font_style="Caption", font_size="9sp", theme_text_color="Hint", size_hint_y=None, height=dp(16)))
                card.add_widget(vbox); self.list_w.add_widget(card)
        except Exception as e: print(f"history load err {e}"); traceback.print_exc()



class OmegaCombinedApp(MDApp):
    def build(self):
        Window.clearcolor = (0.96, 0.96, 0.96, 1)
        self.theme_cls.primary_palette="Blue"
        self.theme_cls.theme_style="Light"
        try:
            conn=get_conn(); cur=conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS resellers (id INTEGER PRIMARY KEY AUTOINCREMENT, store_name TEXT UNIQUE, credit_balance REAL DEFAULT 0)")
            cur.execute("CREATE TABLE IF NOT EXISTS daily_sales (id INTEGER PRIMARY KEY, sales_date TEXT, reseller_id INTEGER, quantity INTEGER, kg_size TEXT, total_sales REAL, mode TEXT, payment TEXT, reseller_name TEXT, notes TEXT)")
            cur.execute("CREATE TABLE IF NOT EXISTS machines (id INTEGER PRIMARY KEY AUTOINCREMENT, machine_name TEXT NOT NULL, date_purchase TEXT, unit_price REAL DEFAULT 0, power_rating TEXT, wattage REAL DEFAULT 0, vendor TEXT, capacity REAL DEFAULT 0, capacity_unit TEXT DEFAULT 'kg/day', pm_date TEXT, filter_change_date TEXT, notes TEXT)")
            cur.execute("CREATE TABLE IF NOT EXISTS machine_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id INTEGER NOT NULL, log_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT, output_kg REAL DEFAULT 0, operating_hours REAL DEFAULT 0, kwph REAL DEFAULT 0, electricity_rate REAL DEFAULT 12, electricity_expense REAL DEFAULT 0, efficiency REAL DEFAULT 0, status TEXT DEFAULT 'RUNNING', cost_per_kg REAL DEFAULT 0)")
            cur.execute("CREATE TABLE IF NOT EXISTS pm_history (id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id INTEGER NOT NULL, pm_done_date TEXT, next_pm_due TEXT, filter_done_date TEXT, next_filter_due TEXT, notes TEXT, created_at TEXT)")
            conn.commit(); conn.close()
        except Exception as e:
            print(e)
        sm=MDScreenManager()
        sm.add_widget(CashierScreen(name='cashier'))
        sm.add_widget(MachineListScreen(name='machine_list'))
        sm.add_widget(MachineFormScreen(name='machine_form'))
        sm.add_widget(MachineMonitoringScreen(name='machine_monitor'))
        sm.add_widget(MachineAnalyticsScreen(name='machine_analytics'))
        sm.add_widget(PMHistoryScreen(name='pm_history'))
        self.sm=sm
        sm.current='cashier'
        return sm

OmegaCombinedApp().run()
