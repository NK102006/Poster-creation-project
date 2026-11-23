import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/apiClient';
import styles from './DoctorInfo.module.css';

function whatsappHref(number) {
  const digits = String(number || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

export default function DoctorInfo() {
  const [doctor, setDoctor] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    apiRequest('/doctors/current')
      .then((r) => {
        if (active) setDoctor(r.doctor);
      })
      .catch(() => {
        if (active) setError('Doctor information is currently unavailable.');
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className={styles.message} role="status">
        {error}
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className={styles.loading} aria-label="Loading doctor information">
        Loading doctor information…
      </div>
    );
  }

  const href = whatsappHref(doctor.contactnumber);

  return (
    <section className={styles.card} aria-labelledby="doctor-info-title">
      <div className={styles.logoWrap}>
        <div className={styles.avatarCircle}>
          {doctor.photo || doctor.logo ? (
            <img src={doctor.photo || doctor.logo} alt="" className={styles.logo} />
          ) : (
            <span className={styles.fallback} aria-hidden="true">
              Dr
            </span>
          )}
        </div>
        {doctor.logo && (doctor.photo || doctor.name) && (
          <div className={styles.attachedLogo} title="Attached Doctor Logo">
            <img src={doctor.logo} alt="" className={styles.attachedLogoImg} />
          </div>
        )}
      </div>
      <div>
        <p className={styles.eyebrow}>Your doctor</p>
        <h2 id="doctor-info-title" className={styles.name}>
          {doctor.name}
        </h2>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={styles.whatsapp}
            aria-label={`Contact ${doctor.name} on WhatsApp`}
          >
            WhatsApp · {doctor.contactnumber}
          </a>
        ) : (
          <p className={styles.number}>WhatsApp number unavailable</p>
        )}
      </div>
    </section>
  );
}
