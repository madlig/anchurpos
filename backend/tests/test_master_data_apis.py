"""Backend tests for Master Data APIs: products, variants, ingredients PATCH/DELETE"""
import pytest
import requests
import os

BASE_URL = "https://2efbefe8-3f79-4d76-bc85-e3d87d1bc1f6.preview.emergentagent.com"

# --- Auth helper ---
@pytest.fixture(scope="module")
def manager_token():
    """Login as manager and get token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "manager", "password": "anchur123"})
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("token") or data.get("idToken") or data.get("customToken")
        return token
    pytest.skip(f"Auth failed: {resp.status_code} {resp.text}")

@pytest.fixture(scope="module")
def auth_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}", "Content-Type": "application/json"}

# --- Get IDs for testing ---
@pytest.fixture(scope="module")
def first_product_id(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
    assert resp.status_code == 200
    products = resp.json()
    assert len(products) > 0, "No products in seed data"
    return products[0]["id"]

@pytest.fixture(scope="module")
def first_variant_id(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/variants", headers=auth_headers)
    assert resp.status_code == 200
    variants = resp.json()
    assert len(variants) > 0, "No variants in seed data"
    return variants[0]["id"]

@pytest.fixture(scope="module")
def first_ingredient_id(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/ingredients", headers=auth_headers)
    assert resp.status_code == 200
    ingredients = resp.json()
    assert len(ingredients) > 0, "No ingredients in seed data"
    return ingredients[0]["id"]


class TestProductsAPI:
    """Tests for /api/products/[id] PATCH and DELETE"""

    def test_get_products_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected seed products"
        print(f"Products count: {len(data)}")

    def test_patch_product(self, auth_headers, first_product_id):
        """PATCH /api/products/[id] should return 200"""
        payload = {
            "name": "TEST_Produk Edit",
            "code": "TEST01",
            "description": "Test description",
            "packPerBatch": 10,
            "priceTiers": [{"minQty": 1, "maxQty": None, "price": 5000}]
        }
        resp = requests.patch(f"{BASE_URL}/api/products/{first_product_id}", json=payload, headers=auth_headers)
        assert resp.status_code == 200, f"PATCH failed: {resp.text}"
        data = resp.json()
        assert data.get("id") == first_product_id
        print(f"PATCH product OK: {data}")

    def test_patch_product_missing_fields(self, auth_headers, first_product_id):
        """PATCH without name should return 400"""
        resp = requests.patch(f"{BASE_URL}/api/products/{first_product_id}", json={"code": "X"}, headers=auth_headers)
        assert resp.status_code == 400
        print(f"PATCH 400 validation OK")

    def test_delete_product_not_exist(self, auth_headers):
        """DELETE non-existent product should return 404"""
        resp = requests.delete(f"{BASE_URL}/api/products/nonexistent_id_xyz", headers=auth_headers)
        assert resp.status_code == 404
        print("DELETE 404 OK")


class TestVariantsAPI:
    """Tests for /api/variants/[id] PATCH and DELETE"""

    def test_get_variants_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/variants", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"Variants count: {len(data)}")

    def test_patch_variant_name(self, auth_headers, first_variant_id):
        """PATCH /api/variants/[id] with name should return 200"""
        resp = requests.patch(f"{BASE_URL}/api/variants/{first_variant_id}", json={"name": "TEST_Varian Edit", "sortOrder": 1, "minStock": 5}, headers=auth_headers)
        assert resp.status_code == 200, f"PATCH variant failed: {resp.text}"
        data = resp.json()
        assert data.get("id") == first_variant_id
        print(f"PATCH variant name OK: {data}")

    def test_patch_variant_stock_opname(self, auth_headers, first_variant_id):
        """PATCH /api/variants/[id] with currentStock should return 200"""
        resp = requests.patch(f"{BASE_URL}/api/variants/{first_variant_id}", json={"currentStock": 50, "note": "TEST opname"}, headers=auth_headers)
        assert resp.status_code == 200, f"PATCH stock opname failed: {resp.text}"
        data = resp.json()
        assert "currentStock" in data
        print(f"PATCH stock opname OK: {data}")

    def test_delete_variant_not_exist(self, auth_headers):
        """DELETE non-existent variant should return 404"""
        resp = requests.delete(f"{BASE_URL}/api/variants/nonexistent_id_xyz", headers=auth_headers)
        assert resp.status_code == 404
        print("DELETE variant 404 OK")


class TestIngredientsAPI:
    """Tests for /api/ingredients/[id] PATCH and DELETE"""

    def test_get_ingredients_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/ingredients", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"Ingredients count: {len(data)}")

    def test_patch_ingredient(self, auth_headers, first_ingredient_id):
        """PATCH /api/ingredients/[id] should return 200"""
        payload = {"name": "TEST_Bahan Edit", "baseUnit": "kg", "category": "bahan_baku", "minStock": 10}
        resp = requests.patch(f"{BASE_URL}/api/ingredients/{first_ingredient_id}", json=payload, headers=auth_headers)
        assert resp.status_code == 200, f"PATCH ingredient failed: {resp.text}"
        data = resp.json()
        assert data.get("id") == first_ingredient_id
        print(f"PATCH ingredient OK: {data}")

    def test_patch_ingredient_missing_fields(self, auth_headers, first_ingredient_id):
        """PATCH without baseUnit should return 400"""
        resp = requests.patch(f"{BASE_URL}/api/ingredients/{first_ingredient_id}", json={"name": "test"}, headers=auth_headers)
        assert resp.status_code == 400
        print("PATCH ingredient 400 validation OK")

    def test_delete_ingredient_not_exist(self, auth_headers):
        """DELETE non-existent ingredient should return 404"""
        resp = requests.delete(f"{BASE_URL}/api/ingredients/nonexistent_id_xyz", headers=auth_headers)
        assert resp.status_code == 404
        print("DELETE ingredient 404 OK")
