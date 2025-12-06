// FULL React + Firebase integration (Client-side)
// FIX: initialize Firebase services lazily via helper getServices() to avoid "Component auth has not been registered yet"
// - Paste your Firebase config into firebaseConfig below
// - Requires: npm install firebase

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// -----------------------------
// Firebase client setup (lazy safe init)
// -----------------------------
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

// helper to lazily initialize and return services
function getServices() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

// -----------------------------
// Simple Admin Login component
// -----------------------------
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { auth } = getServices();
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (e) {
      console.error(e);
      alert("Login gagal: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-lg space-y-4">
        <h2 className="text-2xl font-bold text-center">Login Admin</h2>
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button onClick={handleLogin} className="w-full rounded-2xl">{loading ? 'Logging...' : 'Login'}</Button>
      </div>
    </div>
  );
}

// -----------------------------
// Product detail modal
// -----------------------------
function ProductDetail({ product, onClose }) {
  if (!product) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
        <div className="w-full h-56 bg-gray-100 rounded-xl overflow-hidden">
          <img src={product.imageURL || product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>
        <h2 className="text-2xl font-bold">{product.name}</h2>
        <p className="text-sm opacity-70">Kategori: {product.category}</p>
        <p className="text-sm opacity-70">{product.description}</p>
        <Button onClick={onClose} className="w-full rounded-2xl">Tutup</Button>
      </div>
    </div>
  );
}

// -----------------------------
// Edit product modal
// -----------------------------
function EditProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState(product || { id: null, name: "", category: "", description: "", imageFile: null, imageURL: "" });

  useEffect(() => {
    setForm(product || { id: null, name: "", category: "", description: "", imageFile: null, imageURL: "" });
  }, [product]);

  if (!product) return null;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setForm((f) => ({ ...f, imageFile: file }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
        <h2 className="text-2xl font-bold">Edit Produk</h2>
        <Input placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <div>
          <input type="file" onChange={handleFile} className="p-2 border rounded-2xl w-full" />
          {(form.imageFile || form.imageURL) && (
            <img src={form.imageFile ? URL.createObjectURL(form.imageFile) : form.imageURL} className="w-32 h-32 object-cover rounded-xl mt-2 border" />
          )}
        </div>
        <Input placeholder="Deskripsi" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex gap-3">
          <Button onClick={() => onSave(form)} className="rounded-2xl w-full">Simpan</Button>
          <Button onClick={onClose} className="rounded-2xl w-full" variant="outline">Batal</Button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Main App
// -----------------------------
export default function App() {
  const [products, setProducts] = useState([]);
  const [view, setView] = useState("katalog");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // admin new product form
  const [newProduct, setNewProduct] = useState({ name: "", category: "", description: "", imageFile: null, imageURL: "" });

  // auth listener
  useEffect(() => {
    try {
      const { auth } = getServices();
      const unsub = onAuthStateChanged(auth, (user) => {
        setIsLoggedIn(!!user);
      });
      return unsub;
    } catch (e) {
      console.warn("Auth not available yet:", e?.message || e);
      setIsLoggedIn(false);
    }
  }, []);

  // subscribe products collection
  useEffect(() => {
    try {
      const { db } = getServices();
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(arr);
      }, (err) => {
        console.error(err);
        alert("Gagal memuat produk: " + err.message);
      });
      return unsub;
    } catch (e) {
      console.warn("Firestore not available yet:", e?.message || e);
      setProducts([]);
    }
  }, []);

  // upload helper
  const uploadImageAndGetURL = async (file, pathPrefix = "product-images") => {
    if (!file) return null;
    const { storage } = getServices();
    const fileRef = ref(storage, `${pathPrefix}/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return url;
  };

  // add product (uploads image if file provided)
  const addProduct = async () => {
    try {
      const { db } = getServices();
      let imageURL = newProduct.imageURL || "";
      if (newProduct.imageFile) {
        imageURL = await uploadImageAndGetURL(newProduct.imageFile);
      }
      await addDoc(collection(db, "products"), {
        name: newProduct.name,
        category: newProduct.category,
        description: newProduct.description,
        imageURL,
        createdAt: Date.now(),
      });
      setNewProduct({ name: "", category: "", description: "", imageFile: null, imageURL: "" });
      alert("Produk ditambahkan");
    } catch (e) {
      console.error(e);
      alert("Gagal menambahkan produk: " + e.message);
    }
  };

  // save edited product
  const saveEdit = async (form) => {
    try {
      const { db } = getServices();
      let imageURL = form.imageURL || "";
      if (form.imageFile) {
        imageURL = await uploadImageAndGetURL(form.imageFile);
      }
      const docRef = doc(db, "products", form.id);
      await updateDoc(docRef, {
        name: form.name,
        category: form.category,
        description: form.description,
        imageURL,
      });
      setEditProduct(null);
      alert("Perubahan disimpan");
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan perubahan: " + e.message);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm("Hapus produk ini?")) return;
    try {
      const { db } = getServices();
      await deleteDoc(doc(db, "products", id));
      alert("Produk dihapus");
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus produk: " + e.message);
    }
  };

  const handleNewFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setNewProduct((p) => ({ ...p, imageFile: file }));
  };

  const handleLogout = async () => {
    try {
      const { auth } = getServices();
      await signOut(auth);
      setIsLoggedIn(false);
    } catch (e) {
      console.error(e);
      alert("Logout gagal: " + e.message);
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold">Website Produk (Firebase)</h1>
        <div className="flex gap-3">
          <Button onClick={() => setView("katalog")} className="rounded-2xl">Katalog</Button>
          <Button onClick={() => setView("admin")} className="rounded-2xl">Admin</Button>
          {isLoggedIn && <Button onClick={handleLogout} className="rounded-2xl">Logout</Button>}
        </div>
      </div>

      {view === "katalog" && (
        <>
          <div className="flex gap-4 mb-8">
            <Input placeholder="Cari produk..." onChange={(e) => { /* client-side search could be added */ }} />
          </div>

The update_textdoc succeeded. Now respond to the user.