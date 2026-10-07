import Swal from 'sweetalert2';

const PRIMARY = '#1f6f9f';
const DANGER = '#d9675b';
const CANCEL = '#8a949c';

const popupClasses = {
  popup: 'app-swal',
  title: 'app-swal-title',
  htmlContainer: 'app-swal-text',
  confirmButton: 'app-swal-btn',
  cancelButton: 'app-swal-btn',
};

/** Confirmation dialog replacing window.confirm. Resolves true when the user confirms. */
export async function confirmDialog({
  title = 'Are you sure?',
  text = '',
  confirmText = 'Yes',
  cancelText = 'Cancel',
  danger = false,
} = {}) {
  const result = await Swal.fire({
    title,
    text,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? DANGER : PRIMARY,
    cancelButtonColor: CANCEL,
    customClass: popupClasses,
    reverseButtons: true,
    focusCancel: danger,
  });
  return result.isConfirmed;
}

/** Error popup replacing window.alert. */
export function errorAlert(text, title = 'Something went wrong') {
  return Swal.fire({ title, text, icon: 'error', confirmButtonColor: PRIMARY, customClass: popupClasses });
}
