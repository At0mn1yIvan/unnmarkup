import io
import json

import numpy as np
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from markup.forms import SignalUploadForm
from markup.models import Markup, Signal

User = get_user_model()


@pytest.fixture
def user_marker(db):
    user = User.objects.create_user(
        username="marker",
        password="pass",
        role="user_marker",
        first_name="Test",
        last_name="Marker",
    )
    return user


@pytest.fixture
def user_supplier(db):
    user = User.objects.create_user(
        username="supplier",
        password="pass",
        role="user_supplier",
        first_name="Sup",
        last_name="Plier",
    )
    return user


@pytest.fixture
def signal_file(tmp_path):
    # create a valid numpy array file
    arr = np.zeros((12, 5000), dtype=float)
    path = tmp_path / "signal.npy"
    np.save(str(path), arr)
    return path


@pytest.mark.django_db
class TestSignalUploadForm:
    def test_clean_files_accepts_valid_and_transposes(
        self, user_supplier, signal_file
    ):
        # prepare file in 5000x12 shape
        arr = np.zeros((5000, 12))
        buf = io.BytesIO()
        np.save(buf, arr)
        buf.seek(0)
        uploaded = SimpleUploadedFile(
            "test.npy", buf.read(), content_type="application/octet-stream"
        )
        form = SignalUploadForm(
            data={"sample_rate": 500},
            files={"files": [uploaded]},
            supplier=user_supplier.supplier_profile,
        )
        assert form.is_valid(), form.errors.as_json()
        files = form.cleaned_data["files"]
        assert len(files) == 1
        # saved instance test
        instances = form.save()
        assert isinstance(instances[0], Signal)

    def test_clean_files_rejects_wrong_extension(
        self, user_supplier, tmp_path
    ):
        bad = SimpleUploadedFile("bad.txt", b"data")
        form = SignalUploadForm(
            data={"sample_rate": 500},
            files={"files": [bad]},
            supplier=user_supplier.supplier_profile,
        )
        with pytest.raises(Exception):
            form.clean_files()


@pytest.mark.django_db
class TestStartNewMarkupView:
    def test_redirects_to_existing_draft(self, client, user_marker):
        client.login(username="marker", password="pass")
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="a.npy",
            data_file="",
            sample_rate=500,
        )
        draft = Markup.objects.create(
            signal=sig,
            marker=mprofile,
            status="draft",
            expires_at=timezone.now() + timezone.timedelta(hours=1),
            markup_data=[],
        )
        url = reverse("markup:start_new_markup")
        response = client.get(url)
        assert response.status_code == 302
        assert str(draft.id) in response["Location"]

    def test_creates_new_markup(self, client, user_marker):
        client.login(username="marker", password="pass")
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="b.npy",
            data_file="",
            sample_rate=500,
        )
        url = reverse("markup:start_new_markup")
        response = client.get(url)
        assert response.status_code == 302
        new = Markup.objects.filter(marker=mprofile, status="draft").first()
        assert new is not None


@pytest.mark.django_db
class TestMarkupListView:
    def test_list_view_empty(self, client, user_marker):
        client.login(username="marker", password="pass")
        url = reverse("markup:markup_list")
        response = client.get(url)
        assert response.status_code == 200
        assert "completed_markups" in response.context


@pytest.mark.django_db
class TestPerformMarkupView_GET:
    def test_permission_denied(self, client):
        url = reverse("markup:perform_markup", kwargs={"markup_id": 999})
        client.login(username="marker", password="pass")
        response = client.get(url)
        assert response.status_code == 302

    def test_file_not_found(self, client, user_marker):
        client.login(username="marker", password="pass")
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="c.npy",
            data_file="nonexistent.npy",
            sample_rate=500,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=mprofile,
            status="draft",
            expires_at=None,
            markup_data=[],
        )
        url = reverse("markup:perform_markup", kwargs={"markup_id": markup.id})
        response = client.get(url)
        assert response.status_code == 302


@pytest.mark.django_db
class TestPerformMarkupView_POST:
    def test_invalid_markup_data(self, client, user_marker):
        client.login(username="marker", password="pass")
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="d.npy",
            data_file="",
            sample_rate=500,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=mprofile,
            status="draft",
            expires_at=None,
            markup_data=[],
        )
        url = reverse("markup:perform_markup", kwargs={"markup_id": markup.id})
        response = client.post(
            url, {"markup_data": "notjson", "diagnoses_data": "[]"}
        )
        assert response.status_code == 302

    def test_invalid_diagnoses_data(self, client, user_marker):
        client.login(username="marker", password="pass")
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="e.npy",
            data_file="",
            sample_rate=500,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=mprofile,
            status="draft",
            expires_at=None,
            markup_data=[],
        )
        url = reverse("markup:perform_markup", kwargs={"markup_id": markup.id})
        # wrong format path
        response = client.post(
            url,
            {"markup_data": "[]", "diagnoses_data": json.dumps(["badpath"])},
        )
        assert response.status_code == 302

    def test_success_post(self, client, user_marker, db):
        client.login(username="marker", password="pass")
        from markup.models import Diagnosis

        parent = Diagnosis.objects.create(name="P", parent=None)
        child = Diagnosis.objects.create(name="C", parent=parent)
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="f.npy",
            data_file="",
            sample_rate=500,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=mprofile,
            status="draft",
            expires_at=None,
            markup_data=[],
        )
        data = [{"type": "P", "x0": 1, "x1": 2}]
        diag = [f"{parent.name} | {child.name}"]
        url = reverse("markup:perform_markup", kwargs={"markup_id": markup.id})
        response = client.post(
            url,
            {
                "markup_data": json.dumps(data),
                "diagnoses_data": json.dumps(diag),
            },
        )
        assert response.status_code == 302
        m = Markup.objects.get(pk=markup.id)
        assert m.status == "pending_validation"
        assert m.diagnoses.count() == 1


@pytest.mark.django_db
class TestSignalUploadFormExtra:
    def test_form_invalid_no_files(self, user_supplier):
        form = SignalUploadForm(
            data={"sample_rate": 500},
            files={},  # No files
            supplier=user_supplier.supplier_profile,
        )
        assert not form.is_valid()

    def test_form_invalid_sample_rate_zero(self, user_supplier, signal_file):
        uploaded = SimpleUploadedFile(
            "sig.npy",
            open(signal_file, "rb").read(),
            content_type="application/octet-stream",
        )
        form = SignalUploadForm(
            data={"sample_rate": 0},
            files={"files": [uploaded]},
            supplier=user_supplier.supplier_profile,
        )
        assert not form.is_valid()


@pytest.mark.django_db
class TestSignalModel:
    def test_signal_str(self, user_supplier):
        signal = Signal.objects.create(
            supplier=user_supplier.supplier_profile,
            original_filename="abc.npy",
            data_file="abc.npy",
            sample_rate=100,
        )
        assert "abc.npy" in str(signal)


@pytest.mark.django_db
class TestMarkupWorkflow:
    def test_markup_expired_status(self, user_marker):
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="exp.npy",
            data_file="",
            sample_rate=100,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=mprofile,
            status="draft",
            expires_at=timezone.now() - timezone.timedelta(minutes=1),
            markup_data=[],
        )
        assert markup.is_expired is True

    def test_markup_not_expired_status(self, user_marker):
        mprofile = user_marker.marker_profile
        sig = Signal.objects.create(
            supplier=None,
            original_filename="live.npy",
            data_file="",
            sample_rate=100,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=mprofile,
            status="draft",
            expires_at=timezone.now() + timezone.timedelta(minutes=5),
            markup_data=[],
        )
        assert markup.is_expired is False


@pytest.mark.django_db
class TestMarkupListViewExtra:
    def test_pending_validation_markup_in_context(self, client, user_marker):
        client.login(username="marker", password="pass")
        sig = Signal.objects.create(
            supplier=None,
            original_filename="g.npy",
            data_file="",
            sample_rate=500,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=user_marker.marker_profile,
            status="pending_validation",
            expires_at=None,
            markup_data=[],
        )
        url = reverse("markup:markup_list")
        response = client.get(url)
        assert response.status_code == 200
        assert markup in response.context["completed_markups"]


@pytest.mark.django_db
class TestPerformMarkupPermissions:
    def test_different_user_access_denied(self, client, user_marker, db):
        other_user = User.objects.create_user(
            username="intruder", password="pass", role="user_marker"
        )
        sig = Signal.objects.create(
            supplier=None,
            original_filename="secret.npy",
            data_file="",
            sample_rate=100,
        )
        markup = Markup.objects.create(
            signal=sig,
            marker=user_marker.marker_profile,
            status="draft",
            expires_at=None,
            markup_data=[],
        )
        client.login(username="intruder", password="pass")
        url = reverse("markup:perform_markup", kwargs={"markup_id": markup.id})
        response = client.get(url)
        assert response.status_code == 302


@pytest.mark.django_db
class TestStartNewMarkupConcurrency:
    def test_only_one_draft_per_user(self, client, user_marker):
        client.login(username="marker", password="pass")
        mprofile = user_marker.marker_profile
        sig1 = Signal.objects.create(
            supplier=None,
            original_filename="a1.npy",
            data_file="",
            sample_rate=500,
        )
        sig2 = Signal.objects.create(
            supplier=None,
            original_filename="a2.npy",
            data_file="",
            sample_rate=500,
        )
        Markup.objects.create(
            signal=sig1,
            marker=mprofile,
            status="draft",
            expires_at=timezone.now() + timezone.timedelta(minutes=30),
            markup_data=[],
        )
        url = reverse("markup:start_new_markup")
        response = client.get(url)
        assert response.status_code == 302
        # Still only one draft
        assert (
            Markup.objects.filter(marker=mprofile, status="draft").count() == 1
        )
